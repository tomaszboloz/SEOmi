# Local Strix security assessment

Installed CLI: `strix-agent==1.6.2` in an isolated `uv tool` environment.
Sandbox: `ghcr.io/usestrix/strix-sandbox:1.3.0`.
Verified image digest:
`sha256:f6906c3114e504fd1a218fcf028d7a0e46851118403a438b63956de6ea7c4331`.

## Connection

The owner authorized ChatGPT subscription authentication and completed browser OAuth.
Configuration is local at `~/.strix/seomi-config.json` with permission `0600`.
The model is `chatgpt/gpt-6.1-sol`; the upstream documented `gpt-5.4` was rejected
by the account with HTTP 400 before a scan began. No API key is required.
OAuth credentials belong to Strix's private auth storage and are not versioned.
Telemetry is disabled; the configured sandbox image is pinned by digest.

## Run

Docker must be running and `strix auth status` must confirm authentication.
Use `rtk npm run security:strix` from the repository root.
Use `rtk proxy node scripts/run-strix-security.mjs --prepare` to check preparation.

The launcher copies tracked working files and new source/test modules into a
temporary directory, skipping symlinks and common credential filenames.
Only this disposable copy is mounted writable by Strix. The original checkout
is not a scan target. Instructions limit validation to synthetic fixtures in
the copy and exclude third-party targets, production data and LAN scanning.

Scan mode is `quick`, source scope is `full`, and the limit is 40 turns per agent.
The configuration is also passed as environment variables because the installed
CLI's environment preflight did not recognize the custom config alone.
Reports are generated under ignored `reports/strix/strix_runs/`.
Preparation/completion metadata is kept under ignored `reports/strix/`.

## Evidence and limitations

The initial authenticated scan is `source_29c5` (2026-10-02), using a working
copy based on `61c814b` plus the pending Windows overflow test repair.
The scan exited with code 1 after ChatGPT's content guardrail blocked pentest
tasks. The recorded status is failed; no clean security result is claimed.
Inspect `coverage.json` alongside the final findings: missing surfaces, failed
agents or turn-limit termination must be reported as incomplete assessment.

Independent SEOmi checks on 2026-10-02: 20/20 focused frontend transport/security
tests and 457 native tests passed locally. These are not Strix findings and do
not establish Windows/macOS runtime security or absence of vulnerabilities.

Strix documentation: https://docs.strix.ai/advanced/configuration
Repository: https://github.com/usestrix/strix
