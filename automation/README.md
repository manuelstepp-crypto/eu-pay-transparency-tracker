# Automation — Weekly EU Pay Transparency Tracker

Two Anthropic Managed Agents run jeden Montag 12:00 Europe/Berlin:

1. **Researcher** (`agent_011CaWwoKRE2htghS8t3gaZk`)
   Recherchiert Updates der letzten 7 Tage zur EU Pay Transparency Directive (2023/970) in allen 27 EU-Mitgliedstaaten, aktualisiert `data.json`, schreibt strukturierte Quellen nach `data/claims-<KW>.json`, generiert HeyGen-Skript und LinkedIn-Post in `scripts/`.
   Pusht alles auf Branch `weekly-update/<KW>` (NICHT auf main).

2. **QA Reviewer** (`agent_011CaWwoM1UrUqYF7qESbSnE`)
   Fetcht jede Quelle aus `claims-<KW>.json` und validiert sie. Schreibt `qa/<KW>-report.md`.
   - Bei `VERDICT: PASS` → ff-merge auf main + push
   - Bei `VERDICT: FAIL` → Branch bleibt liegen, manueller Review nötig

## Resources

- **Environment**: `env_01RUKTFjQEpxG5bbfoXbkDsw` — siehe `agents.json`
- **GitHub PAT**: macOS Keychain, service `eu-pay-tracker-github-pat` (fine-grained, `Contents: Read and write` auf dieses Repo, no expiration)
- **Anthropic API key**: macOS Keychain, service `eu-pay-tracker-anthropic-key`

## Lokal manuell triggern

```sh
python3 automation/weekly_run.py
```

Logs landen in `automation/logs/<KW>.log` (gitignored).

## Scheduled Task

Läuft via Claude Code Scheduled Task `eu-pay-weekly-update` (cron `0 12 * * MON`). Verwaltet via `mcp__scheduled-tasks`.

## Token-Rotation

Wenn der GitHub PAT rotiert oder revoked werden muss:
1. Auf github.com/settings/personal-access-tokens — `eu-pay-tracker-managed-agent` revoken
2. Neu generieren mit gleichem Scope (`Contents: Read and write` auf dieses Repo)
3. `security add-generic-password -a "$USER" -s "eu-pay-tracker-github-pat" -w "$NEW_TOKEN" -U`
