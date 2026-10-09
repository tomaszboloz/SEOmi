use super::validate_server_path;
use std::{fs, path::PathBuf};

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("seomi-mcp-paths-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        Self(path)
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn validates_real_javascript_files_case_insensitively_and_rejects_missing_or_directory_paths() {
    let fixture = Fixture::new();
    let server = fixture.0.join("server.js");
    fs::write(&server, "console.log('fixture');").unwrap();
    let expected = dunce::canonicalize(&server)
        .unwrap()
        .to_string_lossy()
        .into_owned();
    assert_eq!(
        validate_server_path(&format!(" {} ", server.display())).unwrap(),
        expected
    );
    #[cfg(windows)]
    {
        assert!(!expected.starts_with(r"\\?\"));
        assert_eq!(
            validate_server_path(&server.canonicalize().unwrap().to_string_lossy()).unwrap(),
            expected
        );
    }

    let uppercase = fixture.0.join("SERVER.JS");
    fs::write(&uppercase, "console.log('fixture');").unwrap();
    assert_eq!(
        validate_server_path(&uppercase.to_string_lossy()).unwrap(),
        dunce::canonicalize(&uppercase).unwrap().to_string_lossy()
    );

    let missing = fixture.0.join("missing.js");
    assert_eq!(
        validate_server_path(&missing.to_string_lossy()).unwrap_err(),
        "The selected MCP server file does not exist or cannot be read."
    );

    let directory = fixture.0.join("directory.Js");
    fs::create_dir(&directory).unwrap();
    assert_eq!(
        validate_server_path(&directory.to_string_lossy()).unwrap_err(),
        "The selected MCP server path is not a file."
    );
}
