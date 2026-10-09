use super::{required_capabilities, ResearchDirectory, ResolvedCommand};
use std::{fs, path::PathBuf};

pub(super) fn research_fixture(
    provider: &str,
    fail: bool,
) -> (ResearchDirectory, ResolvedCommand, PathBuf) {
    let root = std::env::temp_dir().join(format!("seomi-research-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&root).unwrap();
    let flags = required_capabilities(provider).join(" ");
    #[cfg(windows)]
    let program = {
        let path = root.join("fixture.cmd");
        fs::write(
            &path,
            format!(
                "@echo off\r\nif \"%~1\"==\"--help\" (echo {flags}& exit /b 0)\r\nif \"%~2\"==\"--help\" (echo {flags}& exit /b 0)\r\nset \"SEOMI_FIXTURE_ARGS=%*\"\r\npowershell.exe -NoProfile -NonInteractive -File \"%~dp0probe.ps1\"\r\nexit /b %errorlevel%\r\n"
            ),
        )
        .unwrap();
        fs::write(
            root.join("probe.ps1"),
            format!(
                r#"
[Console]::InputEncoding = [Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
$root = $PSScriptRoot
[IO.File]::WriteAllText((Join-Path $root 'cwd.txt'), (Get-Location).Path)
$fixtureArgs = @()
if ($env:SEOMI_FIXTURE_ARGS) {{
    $fixtureArgs = [regex]::Matches($env:SEOMI_FIXTURE_ARGS, '"([^"\r\n]*)"|(\S+)') | ForEach-Object {{
        if ($_.Groups[1].Success) {{ $_.Groups[1].Value }} else {{ $_.Groups[2].Value }}
    }}
}}
[IO.File]::WriteAllLines((Join-Path $root 'args.txt'), [string[]]$fixtureArgs)
if ($env:GEMINI_CLI_SYSTEM_SETTINGS_PATH) {{
    Copy-Item $env:GEMINI_CLI_SYSTEM_SETTINGS_PATH (Join-Path $root 'settings.json')
}}
$prompt = [Console]::In.ReadToEnd()
if ({fail}) {{ [Console]::Error.Write('fixture research failure'); exit 7 }}
[Console]::Out.Write($prompt)
"#,
                fail = if fail { "$true" } else { "$false" }
            ),
        )
        .unwrap();
        path
    };
    #[cfg(not(windows))]
    let program = {
        use std::os::unix::fs::PermissionsExt;
        let path = root.join("fixture.sh");
        fs::write(&path, format!(r#"#!/bin/sh
if [ "$1" = '--help' ] || [ "$2" = '--help' ]; then printf '%s' '{flags}'; exit 0; fi
root=$(dirname "$0")
pwd | tr -d '\n' > "$root/cwd.txt"
printf '%s\n' "$@" > "$root/args.txt"
if [ -n "$GEMINI_CLI_SYSTEM_SETTINGS_PATH" ]; then cp "$GEMINI_CLI_SYSTEM_SETTINGS_PATH" "$root/settings.json"; fi
if [ {fail} = true ]; then printf '%s' 'fixture research failure' >&2; exit 7; fi
cat
"#)).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
        path
    };
    (
        ResearchDirectory(root.clone()),
        ResolvedCommand {
            program,
            #[cfg(windows)]
            use_cmd_shell: true,
        },
        root,
    )
}
