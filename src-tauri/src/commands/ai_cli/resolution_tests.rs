use super::{
    execution::process_for,
    paths::{augmented_path, command_candidates, command_directories},
    research::ResearchDirectory,
    resolution::{is_executable, ResolvedCommand},
};
use std::{collections::HashSet, fs};

#[test]
fn executable_validation_rejects_missing_paths_and_directories() {
    let directory = std::env::temp_dir().join(format!("seomi-resolution-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&directory).unwrap();
    let _cleanup = ResearchDirectory(directory.clone());
    assert!(!is_executable(&directory));
    assert!(!is_executable(&directory.join("missing")));
    let file = directory.join("fixture");
    fs::write(&file, "fixture").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&file, fs::Permissions::from_mode(0o600)).unwrap();
        assert!(!is_executable(&file));
        fs::set_permissions(&file, fs::Permissions::from_mode(0o700)).unwrap();
    }
    assert!(is_executable(&file));
}

#[test]
fn paths_are_deduplicated_and_the_direct_process_preserves_literal_arguments() {
    let directories = command_directories();
    assert!(!directories.is_empty());
    assert_eq!(
        directories.len(),
        directories.iter().collect::<HashSet<_>>().len()
    );
    assert!(augmented_path().is_some());
    let candidates = command_candidates("codex");
    assert!(candidates.iter().all(|candidate| directories
        .iter()
        .any(|directory| candidate.starts_with(directory))));
    let resolved = ResolvedCommand {
        program: "fixture".into(),
        #[cfg(windows)]
        use_cmd_shell: false,
    };
    let arguments = vec!["a b".into(), "$(not-a-shell)".into(), "--model".into()];
    let process = process_for(&resolved, &arguments);
    assert_eq!(
        process
            .as_std()
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect::<Vec<_>>(),
        arguments
    );
    assert_eq!(process.as_std().get_program(), "fixture");
}
