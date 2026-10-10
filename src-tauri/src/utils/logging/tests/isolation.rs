use std::{
    process::{Command, Stdio},
    time::{Duration, Instant},
};

/// Keep tracing's process-wide callsite registry independent of unrelated tests.
/// The child still executes the complete concurrency/cancellation assertions.
pub(super) fn completed_in_isolated_process() -> bool {
    let thread = std::thread::current();
    let name = thread
        .name()
        .expect("logging fixture runs on a named test thread");
    if std::env::var("SEOMI_LOGGING_ISOLATED_CASE").as_deref() == Ok(name) {
        return false;
    }
    let mut child = Command::new(std::env::current_exe().expect("current test executable"))
        .args(["--exact", name, "--test-threads=1", "--nocapture"])
        .env("SEOMI_LOGGING_ISOLATED_CASE", name)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("start isolated logging test");
    let deadline = Instant::now() + Duration::from_secs(30);
    loop {
        if child
            .try_wait()
            .expect("poll isolated logging test")
            .is_some()
        {
            break;
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let output = child
                .wait_with_output()
                .expect("reap timed-out logging test");
            panic!(
                "isolated logging test timed out: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    let output = child
        .wait_with_output()
        .expect("collect isolated logging test");
    assert!(
        output.status.success(),
        "isolated logging test {name} failed:\n{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        String::from_utf8_lossy(&output.stdout).contains("1 passed"),
        "isolated test selector must execute one test"
    );
    true
}
