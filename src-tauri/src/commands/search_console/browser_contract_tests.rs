use super::browser::send_browser_to;

#[test]
fn browser_launcher_rejects_invalid_argument_without_spawning() {
    let error = send_browser_to("https://fixture.test/\0invalid").unwrap_err();
    assert!(error.starts_with("Unable to open the system browser:"));
}
