use super::{required_capabilities, ResearchDirectory, ResolvedCommand};
use std::{fs, path::PathBuf};
use uuid::Uuid;

pub(crate) fn executable_fixture(provider: &str) -> (ResearchDirectory, ResolvedCommand, PathBuf) {
    let root = std::env::temp_dir().join(format!("seomi-contract-{}", Uuid::new_v4()));
    fs::create_dir(&root).unwrap();
    let flags = required_capabilities(provider).join(" ");
    #[cfg(windows)]
    {
        let program = root.join("fixture.cmd");
        fs::write(
            &program,
            format!(
                "@echo off\r\nif \"%~1\"==\"--help\" (echo {flags}& exit /b 0)\r\nif \"%~2\"==\"--help\" (echo {flags}& exit /b 0)\r\npowershell.exe -NoProfile -NonInteractive -File \"%~dp0probe.ps1\"\r\nexit /b %errorlevel%\r\n"
            ),
        )
        .unwrap();
        fs::write(
            root.join("probe.ps1"),
            r#"
[Console]::InputEncoding = [Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
$prompt = [Console]::In.ReadToEnd()
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'prompt.txt'), $prompt, [Text.UTF8Encoding]::new())
[Console]::Out.Write('answer')
"#,
        )
        .unwrap();
        (
            ResearchDirectory(root.clone()),
            ResolvedCommand {
                program,
                use_cmd_shell: true,
            },
            root,
        )
    }
    #[cfg(not(windows))]
    {
        use std::os::unix::fs::PermissionsExt;
        let program = root.join("fixture.sh");
        fs::write(
            &program,
            format!(
                r#"#!/bin/sh
if [ "$1" = '--help' ] || [ "$2" = '--help' ]; then
  printf '%s' '{flags}'
  exit 0
fi
root=$(dirname "$0")
cat > "$root/prompt.txt"
printf '%s' 'answer'
"#
            ),
        )
        .unwrap();
        fs::set_permissions(&program, fs::Permissions::from_mode(0o700)).unwrap();
        (
            ResearchDirectory(root.clone()),
            ResolvedCommand { program },
            root,
        )
    }
}
