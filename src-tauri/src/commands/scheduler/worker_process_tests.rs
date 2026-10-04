use std::{process::Command, time::Duration};

#[test]
fn worker_context_child() {
    let Ok(expected) = std::env::var("SEOMI_LAUNCH_EXPECTED") else {
        return;
    };
    let recurring = crate::commands::scheduled_worker::headless_launch_context();
    let queue = crate::commands::audit_queue_worker::headless_launch_context();
    let ui = super::scheduled_launch_context();
    let pair = Some(("project-1".into(), "task-2".into()));
    match expected.as_str() {
        "recurring" => {
            assert_eq!(recurring, pair);
            assert!(queue.is_none());
            assert!(ui.headless);
        }
        "queue" => {
            assert_eq!(queue, pair);
            assert!(recurring.is_none());
            assert!(!ui.headless);
        }
        "none" => {
            assert!(recurring.is_none());
            assert!(queue.is_none());
        }
        _ => panic!("invalid child expectation"),
    }
}

#[tokio::test]
async fn public_worker_contexts_read_real_arguments_in_an_isolated_process() {
    let cases = [
        ("none", vec![]),
        (
            "recurring",
            vec![
                "--seomi-scheduled-headless",
                "--seomi-scheduled-project",
                "project-1",
                "--seomi-scheduled-id",
                "task-2",
            ],
        ),
        (
            "queue",
            vec![
                "--seomi-audit-queue-headless",
                "--seomi-scheduled-project",
                "project-1",
                "--seomi-scheduled-id",
                "task-2",
            ],
        ),
        (
            "none",
            vec![
                "--seomi-scheduled-headless",
                "--seomi-scheduled-project",
                "--seomi-scheduled-headless",
                "--seomi-scheduled-id",
                "task-2",
            ],
        ),
        (
            "none",
            vec![
                "--seomi-audit-queue-headless",
                "--seomi-scheduled-project",
                "project-1",
                "--seomi-scheduled-id",
                "--seomi-audit-queue-headless",
            ],
        ),
    ];
    for (expected, arguments) in cases {
        let executable = std::env::current_exe().unwrap();
        let output = tokio::time::timeout(
            Duration::from_secs(15),
            tokio::task::spawn_blocking(move || {
                Command::new(executable)
                    .args([
                        "--exact",
                        "commands::scheduler::worker_process_tests::worker_context_child",
                        "--nocapture",
                        "--",
                    ])
                    .args(arguments)
                    .env("SEOMI_LAUNCH_EXPECTED", expected)
                    .output()
                    .unwrap()
            }),
        )
        .await
        .unwrap()
        .unwrap();
        assert!(
            output.status.success(),
            "child failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        let stdout = String::from_utf8_lossy(&output.stdout);
        assert!(
            stdout.contains("1 passed; 0 failed"),
            "child assertions did not run: {stdout}"
        );
    }
}
