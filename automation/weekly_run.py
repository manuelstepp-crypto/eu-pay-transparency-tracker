#!/usr/bin/env python3
"""Weekly EU Pay Transparency Tracker run.

Spawns two Anthropic Managed Agents sessions:
  1. Researcher — produces dashboard updates + scripts on a feature branch.
  2. QA Reviewer — validates the branch and merges to main on PASS.

Credentials are read from macOS Keychain. Agent IDs from agents.json next to this file.
"""

from __future__ import annotations

import datetime
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import anthropic

HERE = Path(__file__).parent
CONFIG_PATH = HERE / "agents.json"
LOG_DIR = HERE / "logs"
LOG_DIR.mkdir(exist_ok=True)

RETRY_WAIT_SECONDS = 90
TERMINAL_OK = {"end_turn"}
RETRYABLE_FAIL = {"retries_exhausted"}


def keychain_get(service: str) -> str:
    out = subprocess.check_output(
        ["security", "find-generic-password", "-s", service, "-a", os.environ["USER"], "-w"],
        text=True,
    ).strip()
    if not out:
        raise SystemExit(f"keychain entry '{service}' is empty")
    return out


def iso_week() -> str:
    today = datetime.date.today()
    year, week, _ = today.isocalendar()
    return f"{year}-W{week:02d}"


def run_session(
    client: anthropic.Anthropic,
    agent_id: str,
    env_id: str,
    repo_url: str,
    github_token: str,
    kickoff: str,
    title: str,
    log_file: Path,
    branch: str | None = None,
) -> tuple[str, str]:
    """Run a single session to completion. Returns (session_id, stop_reason).

    stop_reason is one of: end_turn, retries_exhausted, terminated, or another
    transient idle reason. Caller decides what to do with it.
    """
    resources: list[dict] = [
        {
            "type": "github_repository",
            "url": repo_url,
            "authorization_token": github_token,
        }
    ]
    if branch:
        resources[0]["checkout"] = {"type": "branch", "name": branch}

    session = client.beta.sessions.create(
        agent=agent_id,
        environment_id=env_id,
        title=title,
        resources=resources,
    )
    stop_reason = "unknown"

    with log_file.open("a", encoding="utf-8") as fh:
        header = f"\n{'=' * 70}\n[{title}] session={session.id} started at {datetime.datetime.now().isoformat()}\n{'=' * 70}\n"
        print(header, end="")
        fh.write(header)

        with client.beta.sessions.events.stream(session_id=session.id) as stream:
            client.beta.sessions.events.send(
                session_id=session.id,
                events=[
                    {"type": "user.message", "content": [{"type": "text", "text": kickoff}]}
                ],
            )
            for event in stream:
                if event.type == "agent.message":
                    for block in event.content:
                        if block.type == "text":
                            print(block.text, end="", flush=True)
                            fh.write(block.text)
                elif event.type == "agent.thinking":
                    pass
                elif event.type == "session.error":
                    msg = f"\n[ERROR] {event}\n"
                    print(msg, end="")
                    fh.write(msg)
                elif event.type == "session.status_terminated":
                    print(f"\n[{title}] terminated\n")
                    fh.write(f"\n[{title}] terminated\n")
                    stop_reason = "terminated"
                    break
                elif event.type == "session.status_idle":
                    if event.stop_reason.type == "requires_action":
                        continue
                    stop_reason = event.stop_reason.type
                    print(f"\n[{title}] idle ({stop_reason})\n")
                    fh.write(f"\n[{title}] idle ({stop_reason})\n")
                    break

    return session.id, stop_reason


def run_session_with_retry(*, max_attempts: int = 2, **kwargs) -> tuple[str, str]:
    """Run a session, retrying once after a wait if it fails on a rate limit."""
    last_reason = "unknown"
    for attempt in range(1, max_attempts + 1):
        title = kwargs.get("title", "session")
        if attempt > 1:
            print(f"\n[{title}] attempt {attempt}/{max_attempts} after waiting {RETRY_WAIT_SECONDS}s\n")
            time.sleep(RETRY_WAIT_SECONDS)
        sid, stop_reason = run_session(**kwargs)
        last_reason = stop_reason
        if stop_reason in TERMINAL_OK:
            return sid, stop_reason
        if stop_reason not in RETRYABLE_FAIL:
            return sid, stop_reason  # non-retryable failure — give up immediately
    return sid, last_reason


def main() -> int:
    config = json.loads(CONFIG_PATH.read_text())
    env_id = config["environment_id"]
    researcher_id = config["researcher_agent_id"]
    qa_id = config["qa_agent_id"]
    repo_url = config["repo_url"]

    os.environ["ANTHROPIC_API_KEY"] = keychain_get("eu-pay-tracker-anthropic-key")
    github_token = keychain_get("eu-pay-tracker-github-pat")

    client = anthropic.Anthropic()
    kw = iso_week()
    branch = f"weekly-update/{kw}"
    log_file = LOG_DIR / f"{kw}.log"

    research_kickoff = (
        f"Führe den wöchentlichen Recherche-Run für {kw} durch.\n\n"
        f"1. Erstelle einen neuen Branch `{branch}` von main.\n"
        f"2. Recherchiere Updates der letzten 7 Tage zur EU Pay Transparency Directive in allen 27 Mitgliedstaaten.\n"
        f"3. Aktualisiere `data.json` (und ggf. weitere Dashboard-Dateien) mit dem neuen Stand.\n"
        f"4. Schreibe `data/claims-{kw}.json` mit allen Quellen.\n"
        f"5. Generiere `scripts/{kw}-heygen.md` und `scripts/{kw}-linkedin.md`.\n"
        f"6. Committe und pushe alles auf `{branch}` — NICHT mergen."
    )

    qa_kickoff = (
        f"Führe QA-Review für Branch `{branch}` durch ({kw}).\n\n"
        f"1. Lies alle Änderungen via `git diff main...HEAD`.\n"
        f"2. Validiere alle Einträge in `data/claims-{kw}.json` durch URL-Fetch.\n"
        f"3. Prüfe Vollständigkeit, Stil-Konsistenz, sachliche Korrektheit.\n"
        f"4. Schreibe `qa/{kw}-report.md` mit `VERDICT: PASS` oder `VERDICT: FAIL` als letzter Zeile.\n"
        f"5. Bei PASS: committe Report auf Branch, dann ff-merge auf main und push.\n"
        f"6. Bei FAIL: nur Report auf Branch pushen."
    )

    _, research_reason = run_session_with_retry(
        client=client,
        agent_id=researcher_id,
        env_id=env_id,
        repo_url=repo_url,
        github_token=github_token,
        kickoff=research_kickoff,
        title=f"Research {kw}",
        log_file=log_file,
    )
    if research_reason not in TERMINAL_OK:
        print(f"\nResearcher did not finish cleanly (stop_reason={research_reason}). QA skipped.")
        return 1

    _, qa_reason = run_session_with_retry(
        client=client,
        agent_id=qa_id,
        env_id=env_id,
        repo_url=repo_url,
        github_token=github_token,
        kickoff=qa_kickoff,
        title=f"QA {kw}",
        log_file=log_file,
        branch=branch,
    )
    if qa_reason not in TERMINAL_OK:
        print(f"\nQA did not finish cleanly (stop_reason={qa_reason}). Branch {branch} unmerged — review manually.")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
