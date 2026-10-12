use super::paths::directories_for;
use super::research::ResearchDirectory;
use std::{ffi::OsString, fs, path::PathBuf};

#[test]
fn directories_come_from_the_given_path_and_home_without_touching_the_environment() {
    assert!(directories_for(None, None)
        .iter()
        .all(|directory| directory.is_absolute()));
    let home = std::env::temp_dir().join(format!("seomi-paths-{}", uuid::Uuid::new_v4()));
    let version = home.join(".nvm/versions/node/v20.0.0");
    fs::create_dir_all(&version).unwrap();
    let _cleanup = ResearchDirectory(home.clone());
    let path = std::env::join_paths([PathBuf::from("/first"), PathBuf::from("/first")]).unwrap();
    let directories = directories_for(Some(path), Some(home.clone()));
    assert_eq!(directories[0], PathBuf::from("/first"));
    assert_eq!(
        directories
            .iter()
            .filter(|directory| directory.as_path() == "/first")
            .count(),
        1
    );
    assert!(directories.contains(&home.join(".local/bin")));
    assert!(directories.contains(&version.join("bin")));
    let missing_home = home.join("missing");
    let without_nvm = directories_for(Some(OsString::new()), Some(missing_home.clone()));
    assert!(!without_nvm
        .iter()
        .any(|d| d.starts_with(missing_home.join(".nvm"))));
}
