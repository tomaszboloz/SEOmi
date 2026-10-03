use std::{collections::HashSet, env, ffi::OsString, fs, path::PathBuf};

/// A desktop app launched from Finder/Explorer does not necessarily inherit
/// the interactive shell PATH. Resolve the fixed, bundled-provider command in
/// the normal PATH and in the conventional per-user install locations, while
/// never accepting a user-provided executable path from IPC.
pub(super) fn command_directories() -> Vec<PathBuf> {
    let mut directories: Vec<PathBuf> = env::var_os("PATH")
        .map(|value| env::split_paths(&value).collect())
        .unwrap_or_default();

    if let Some(home) = home_directory() {
        directories.extend([
            home.join(".local/bin"),
            home.join(".npm-global/bin"),
            home.join(".npm/bin"),
            home.join(".volta/bin"),
            home.join(".bun/bin"),
            home.join(".cargo/bin"),
            home.join(".config/bin"),
            home.join("AppData/Roaming/npm"),
            home.join("scoop/shims"),
        ]);

        // nvm keeps one bin directory per installed Node version. Reading the
        // directory names is local-only and bounded; no shell is spawned.
        let nvm_versions = home.join(".nvm/versions/node");
        if let Ok(entries) = fs::read_dir(nvm_versions) {
            for entry in entries.flatten().take(32) {
                directories.push(entry.path().join("bin"));
            }
        }
    }

    #[cfg(target_os = "macos")]
    directories.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
    ]);

    #[cfg(target_os = "windows")]
    directories.extend([
        PathBuf::from(r"C:\Program Files\nodejs"),
        PathBuf::from(r"C:\Program Files\Git\cmd"),
    ]);

    let mut seen = HashSet::new();
    directories
        .into_iter()
        .filter(|directory| seen.insert(directory.clone()))
        .collect()
}

pub(super) fn command_candidates(command: &str) -> Vec<PathBuf> {
    let directories = command_directories();
    directories
        .into_iter()
        .flat_map(|directory| {
            #[cfg(target_os = "windows")]
            let names = [
                OsString::from(command),
                OsString::from(format!("{command}.cmd")),
                OsString::from(format!("{command}.exe")),
                OsString::from(format!("{command}.bat")),
            ];
            #[cfg(not(target_os = "windows"))]
            let names = [OsString::from(command)];
            names.into_iter().map(move |name| directory.join(name))
        })
        .collect()
}

pub(super) fn augmented_path() -> Option<OsString> {
    env::join_paths(command_directories()).ok()
}

pub(super) fn home_directory() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        env::var_os("USERPROFILE").map(PathBuf::from)
    }
    #[cfg(not(target_os = "windows"))]
    {
        env::var_os("HOME").map(PathBuf::from)
    }
}
