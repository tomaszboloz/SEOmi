use super::startup::{self, LaunchContext};

#[path = "startup_worker_tests.rs"]
mod worker_tests;

fn mock_app() -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("MockRuntime app should build without an OS window")
}

#[test]
fn launch_context_is_interactive_without_worker_flags() {
    assert_eq!(
        startup::launch_context(&["seomi".into()]),
        LaunchContext::Interactive
    );
}

#[test]
fn launch_context_prioritizes_queue_before_scheduled_worker() {
    let args = [
        "seomi".into(),
        "--seomi-audit-queue-headless".into(),
        "--seomi-scheduled-headless".into(),
        "--seomi-scheduled-project".into(),
        "project".into(),
        "--seomi-scheduled-id".into(),
        "schedule".into(),
    ];
    assert_eq!(
        startup::launch_context(&args),
        LaunchContext::AuditQueue {
            project_id: "project".into(),
            run_id: "schedule".into(),
        }
    );
    assert!(matches!(
        startup::launch_context(&args[2..]),
        LaunchContext::Scheduled { .. }
    ));
}

#[test]
fn interactive_startup_does_not_invoke_side_effects() {
    let mut app = mock_app();
    let result = startup::start_with(
        &mut app,
        LaunchContext::Interactive,
        |_, _, _| async { panic!("interactive startup must not run the queue worker") },
        |_, _, _| async { panic!("interactive startup must not run the scheduled worker") },
        |_| panic!("interactive startup must keep the window visible"),
        |_| panic!("interactive startup must not report a worker failure"),
        |_, _| panic!("interactive startup must not exit"),
    );
    assert!(result.is_ok());
}

#[tokio::test]
async fn startup_delegates_execute_handlers_and_diagnostics() {
    let app = mock_app();
    let handle = app.handle().clone();

    startup::hide_main_window(&handle);
    startup::handle_startup_failure(startup::StartupFailure::AuditQueue);
    startup::handle_startup_failure(startup::StartupFailure::ScheduledTask);

    let queue_err =
        startup::run_audit_queue_task(handle.clone(), "invalid/id".into(), "run".into()).await;
    assert!(queue_err.is_err());

    let sched_err =
        startup::run_scheduled_worker_task(handle.clone(), "invalid/id".into(), "sched".into())
            .await;
    assert!(sched_err.is_err());
}
