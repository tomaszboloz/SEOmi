# Strix assessment: 2026-10-02

CLI 1.6.2; sandbox 1.3.0; ChatGPT subscription authentication.
Model: chatgpt/gpt-6.1-sol. Telemetry disabled.
Run: source_29c5, 11:56:30–12:04:46 UTC; process exit code 1.
Source: disposable working copy based on 61c814b plus the pending Windows test fix.

## Outcome: incomplete

Strix started successfully, mapped the application and performed source/testing
work, then terminated when the provider rejected pentest tasks with
CodexContentGuardrailError (possible cybersecurity risk).
The provider block was not bypassed. Raw run status: failed.
Eleven specialist tasks did not finish cleanly; coverage.complete is false.

Final recorded coverage has eight surfaces: three no_issue_found, five
needs_follow_up; zero filed vulnerabilities. Zero findings here does not prove
that the application is secure. The report records 26 gaps, including tasks
that never finished; those are coverage limitations, not 26 vulnerabilities.

## Work recorded by Strix

- Architecture/native IPC/trust-boundary mapping.
- Four local Semgrep rules over 530 files, 89 informational sink signals,
  followed by two AST passes. This was triage, not 89 confirmed vulnerabilities.
- Gitleaks 8.30.1 scanned about 9.24 MB with no reported leaks in the supplied
  working files. Git history and host credential storage were outside scope.
- Sixteen existing MCP tests passed against unchanged transpiled TS modules,
  using synthetic dependencies and a loopback fixture in the sandbox.

## Limitations recorded by Strix

- No cargo/rustc or macOS/Windows desktop runtime in the Linux sandbox.
- Offline dependency installation could not supply the full frontend Vitest suite.
- Trivy could not scan CVEs without its missing vulnerability database.
- Renderer IPC, OAuth, HTTP destinations, CLI/filesystem, HTML/export and updater
  specialist work did not complete. No clean result is asserted for these areas.

## Follow-up candidates

1. MCP discovery reads an unbounded line before enforcing a 1 MiB response limit.
   Local RED regressions reproduced unbounded reading and orphaned children.
   Bounded reading/queueing and child cleanup were implemented separately. This is our verification, not a filed Strix PoC.
2. Export symlink validation occurs before a separate fs::write. Strix did not
   demonstrate the race or a privilege difference. Keep as an unconfirmed review
   candidate, not a confirmed vulnerability.

## Independent local evidence

Outside Strix: 20/20 focused frontend transport/security tests and 457 Rust tests
passed before the follow-up code changes. Full frontend 2449 and MCP 70 tests
also passed. Follow-up changes require their own verification and fresh CI.

Raw evidence is local and ignored by Git:
reports/strix/strix_runs/source_29c5/{run.json,coverage.json,findings.sarif}.
The scan log is /tmp/seomi-strix-scan.log.
The registered findings.sarif includes coverage records; do not count every
SARIF result as a vulnerability.

Follow-up local verification (BATCH-4s): 2450 frontend, 471 Rust and 70 MCP
tests PASS, with build, ESLint, rustfmt and strict Clippy PASS. Two RED
regressions reproduce the old unbounded read and missing child cleanup.
Fourteen new Rust cases cover bounded streams, notification flood, exact
boundaries, response errors/deadlines, real Node discovery and orphan cleanup;
a physical LOC150 guard covers every extracted source/test module.
