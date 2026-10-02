use super::{collect_fixture_output, ResearchDirectory};
use tokio::process::Command;

pub(crate) async fn collect_bytes_output(
    bytes: &[u8],
    deadline: std::time::Duration,
) -> std::process::Output {
    let directory = std::env::temp_dir().join(format!("seomi-binary-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();
    let _cleanup = ResearchDirectory(directory.clone());
    std::fs::write(directory.join("fixture.bin"), bytes).unwrap();
    #[cfg(target_os = "windows")]
    let mut process = {
        let mut command = Command::new("cmd.exe");
        command.args(["/D", "/C", "type", "fixture.bin"]);
        command
    };
    #[cfg(not(target_os = "windows"))]
    let mut process = {
        let mut command = Command::new("cat");
        command.arg("fixture.bin");
        command
    };
    process.current_dir(&directory).kill_on_drop(true);
    collect_fixture_output(process, "", deadline).await.unwrap()
}

#[tokio::test]
async fn fixture_transmits_control_and_unicode_bytes_without_interpretation() {
    let bytes = "\0\nZażółć & | %PATH% $(whoami)\n".as_bytes();
    let output = collect_bytes_output(bytes, std::time::Duration::from_secs(10)).await;
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    assert_eq!(output.stdout, bytes);
}
