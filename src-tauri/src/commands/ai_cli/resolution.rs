use super::paths::command_candidates;
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone)]
pub(super) struct ResolvedCommand {
    pub(super) program: PathBuf,
    #[cfg(target_os = "windows")]
    pub(super) use_cmd_shell: bool,
}

pub(super) fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

pub(super) fn resolve_command(command: &str) -> Option<ResolvedCommand> {
    command_candidates(command)
        .into_iter()
        .find(|candidate| is_executable(candidate))
        .map(|program| ResolvedCommand {
            #[cfg(target_os = "windows")]
            use_cmd_shell: matches!(
                program.extension().and_then(|extension| extension.to_str()),
                Some("cmd" | "bat")
            ),
            program,
        })
}
