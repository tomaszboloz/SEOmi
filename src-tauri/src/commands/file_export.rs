use std::fs;
use std::path::{Path, PathBuf};

const MAX_EXPORT_BYTES: usize = 256 * 1024;

fn validate_export_path(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value.trim());
    if !path.is_absolute() {
        return Err("The selected export path must be absolute.".into());
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension != "json" && extension != "toml" {
        return Err("MCP configuration exports must use a .json or .toml extension.".into());
    }

    let file_name = path
        .file_name()
        .ok_or_else(|| "The selected export path has no file name.".to_string())?;
    let parent = path
        .parent()
        .ok_or_else(|| "The selected export path has no parent directory.".to_string())?;
    let canonical_parent = parent.canonicalize().map_err(|_| {
        "The selected export directory does not exist or cannot be read.".to_string()
    })?;
    if !canonical_parent.is_dir() {
        return Err("The selected export parent is not a directory.".into());
    }

    let destination = canonical_parent.join(file_name);
    if let Ok(metadata) = fs::symlink_metadata(&destination) {
        if metadata.file_type().is_symlink() {
            return Err("Refusing to overwrite a symbolic link.".into());
        }
        if !metadata.is_file() {
            return Err("The selected export path is not a regular file.".into());
        }
    }
    Ok(destination)
}

#[tauri::command]
pub fn write_mcp_config_file(path: String, contents: String) -> Result<(), String> {
    if contents.is_empty() {
        return Err("The MCP configuration cannot be empty.".into());
    }
    if contents.len() > MAX_EXPORT_BYTES {
        return Err(format!(
            "The MCP configuration exceeds the {} byte export limit.",
            MAX_EXPORT_BYTES
        ));
    }
    if contents.contains('\0') {
        return Err("The MCP configuration contains an invalid null character.".into());
    }

    let destination = validate_export_path(&path)?;
    fs::write(destination, contents)
        .map_err(|_| "The MCP configuration could not be written to the selected file.".into())
}

#[cfg(test)]
mod tests {
    use super::{validate_export_path, write_mcp_config_file, MAX_EXPORT_BYTES};
    use std::fs;

    fn test_directory() -> std::path::PathBuf {
        let directory =
            std::env::temp_dir().join(format!("seomi-mcp-export-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&directory).unwrap();
        directory
    }

    #[test]
    fn accepts_json_and_toml_paths_inside_existing_directories() {
        let directory = test_directory();
        let json = directory.join("client.json");
        let toml = directory.join("client.TOML");
        assert!(validate_export_path(json.to_str().unwrap()).is_ok());
        assert!(validate_export_path(toml.to_str().unwrap()).is_ok());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn rejects_relative_unknown_and_missing_parent_paths() {
        assert!(validate_export_path("client.json").is_err());
        assert!(validate_export_path("/tmp/client.txt").is_err());
        assert!(validate_export_path("/definitely/missing/client.json").is_err());
    }

    #[test]
    fn writes_only_bounded_non_empty_text() {
        let directory = test_directory();
        let destination = directory.join("client.json");
        write_mcp_config_file(destination.to_string_lossy().into_owned(), "{}".into()).unwrap();
        assert_eq!(fs::read_to_string(&destination).unwrap(), "{}");

        let too_large = "x".repeat(MAX_EXPORT_BYTES + 1);
        assert!(write_mcp_config_file(
            directory.join("large.json").to_string_lossy().into_owned(),
            too_large,
        )
        .is_err());
        assert!(write_mcp_config_file(
            directory.join("empty.json").to_string_lossy().into_owned(),
            String::new(),
        )
        .is_err());
        fs::remove_dir_all(directory).unwrap();
    }
    #[test]
    fn concurrent_exports_use_independent_test_directories() {
        let directories = std::thread::scope(|scope| {
            let workers: Vec<_> = (0..32)
                .map(|_| {
                    scope.spawn(|| {
                        let directory = test_directory();
                        let destination = directory.join("client.json");
                        write_mcp_config_file(
                            destination.to_string_lossy().into_owned(),
                            "{}".into(),
                        )
                        .unwrap();
                        assert_eq!(fs::read_to_string(&destination).unwrap(), "{}");
                        fs::remove_dir_all(&directory).unwrap();
                        directory
                    })
                })
                .collect();
            workers
                .into_iter()
                .map(|worker| worker.join().unwrap())
                .collect::<Vec<_>>()
        });
        let unique: std::collections::HashSet<_> = directories.iter().collect();
        assert_eq!(unique.len(), directories.len());
    }
}

#[cfg(test)]
#[path = "file_export_edge_tests.rs"]
mod edge_tests;
