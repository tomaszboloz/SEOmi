use super::super::process::{ProcessRunner, SystemProcessRunner};

#[test]
fn system_runner_output_returns_stdout_and_success_status() {
    let result = SystemProcessRunner
        .output("/usr/bin/printf", &["%s".into(), "seomi-output".into()])
        .expect("printf should be available on macOS and Linux runners");

    assert!(result.success);
    assert_eq!(result.stdout, b"seomi-output");
}
