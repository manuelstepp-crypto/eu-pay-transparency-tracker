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
from pathlib import Path

import anthropic

HERE = Path(__file__).parent
CONFIG_PATH = HERE / "agents.json"
LOG_DIR = HERE / "logs"
LOG_DIR.mkdir(exist_ok=True)


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
) -> str:
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

    with log_file.open("a", encoding="utf-8") as fh:
        header = f"\n{'=' * 70}\n[{title}] session={session.id} started at {datetime.datetime.now().isoformat()}\n{'=' * 70}\n"
        print(header, end="")
        fh.write(header)

        with client.beta.sessions.stream(session_id=session.id) as stream:
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
                    break
                elif event.type == "session.status_idle":
                    if event.stop_reason.type == "requires_action":
                        continue
                    print(f"\n[{title}] idle ({event.stop_reason.type})\n")
                    fh.write(f"\n[{title}] idle ({event.stop_reason.type})\n")
                    break

    return session.id


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

    run_session(
        client,
        agent_id=researcher_id,
        env_id=env_id,
        repo_url=repo_url,
        github_token=github_token,
        kickoff=research_kickoff,
        title=f"Research {kw}",
        log_file=log_file,
    )

    run_session(
        client,
        agent_id=qa_id,
        env_id=env_id,
        repo_url=repo_url,
        github_token=github_token,
        kickoff=qa_kickoff,
        title=f"QA {kw}",
        log_file=log_file,
        branch=branch,
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
