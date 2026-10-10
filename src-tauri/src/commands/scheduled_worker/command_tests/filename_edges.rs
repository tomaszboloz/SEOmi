#[cfg(target_os = "linux")]
use super::*;

#[cfg(target_os = "linux")]
#[test]
fn listing_ignores_non_utf8_filenames_on_linux_filesystems() {
    use std::ffi::OsString;
    use std::os::unix::ffi::OsStringExt;

    let app = fixture();
    let directory = app.project("project-1");
    fs::create_dir_all(&directory).unwrap();
    let invalid_name = OsString::from_vec(vec![0xff, 0xfe]);
    fs::write(directory.join(invalid_name), b"ignored").unwrap();
    assert!(list_scheduled_executions(app.handle(), "project-1".into())
        .unwrap()
        .is_empty());
}
