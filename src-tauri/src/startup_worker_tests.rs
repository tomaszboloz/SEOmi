use super::super::startup::{self, LaunchContext, StartupFailure};
use std::{
    sync::mpsc::{self, Receiver},
    time::Duration,
};

fn mock_app() -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("MockRuntime app should build without an OS window")
}

fn received(rx: Receiver<String>, count: usize) -> Vec<String> {
    (0..count)
        .map(|_| {
            rx.recv_timeout(Duration::from_secs(2))
                .expect("startup worker did not emit its completion event")
        })
        .collect()
}

fn run_worker_case(context: LaunchContext, expected_failure: Option<StartupFailure>) {
    let (queue, expected_worker) = match &context {
        LaunchContext::AuditQueue { project_id, run_id } => {
            (true, format!("worker:{project_id}:{run_id}"))
        }
        LaunchContext::Scheduled {
            project_id,
            schedule_id,
        } => (false, format!("worker:{project_id}:{schedule_id}")),
        LaunchContext::Interactive => panic!("worker case requires a headless context"),
    };
    let failing = expected_failure.is_some();
    let (tx, rx) = mpsc::channel();
    let queue_worker_tx = tx.clone();
    let scheduled_worker_tx = tx.clone();
    let hide_tx = tx.clone();
    let diagnostic_tx = tx.clone();
    let exit_tx = tx;
    startup::start_with(
        &mut mock_app(),
        context,
        move |_, project, id| async move {
            if !queue {
                panic!("scheduled startup must not run the queue worker")
            }
            queue_worker_tx
                .send(format!("worker:{project}:{id}"))
                .unwrap();
            if failing {
                Err("fixture failure".into())
            } else {
                Ok(())
            }
        },
        move |_, project, id| async move {
            if queue {
                panic!("queue startup must not run the scheduled worker")
            }
            scheduled_worker_tx
                .send(format!("worker:{project}:{id}"))
                .unwrap();
            if failing {
                Err("fixture failure".into())
            } else {
                Ok(())
            }
        },
        move |_| hide_tx.send("hide".into()).unwrap(),
        move |actual| match expected_failure {
            Some(expected) => {
                assert_eq!(actual, expected);
                diagnostic_tx.send("diagnostic".into()).unwrap();
            }
            None => panic!("successful startup must not report a failure"),
        },
        move |_, code| {
            assert_eq!(code, 0);
            exit_tx.send("exit".into()).unwrap();
        },
    )
    .expect("headless startup should schedule the worker");
    let mut expected = vec!["hide".into(), expected_worker];
    if failing {
        expected.push("diagnostic".into());
    }
    expected.push("exit".into());
    assert_eq!(received(rx, expected.len()), expected);
}

#[test]
fn queue_success_runs_without_diagnostic() {
    run_worker_case(
        LaunchContext::AuditQueue {
            project_id: "project".into(),
            run_id: "run".into(),
        },
        None,
    );
}

#[test]
fn queue_failure_reports_diagnostic_before_exit() {
    run_worker_case(
        LaunchContext::AuditQueue {
            project_id: "project".into(),
            run_id: "run".into(),
        },
        Some(StartupFailure::AuditQueue),
    );
}

#[test]
fn scheduled_success_runs_without_diagnostic() {
    run_worker_case(
        LaunchContext::Scheduled {
            project_id: "project".into(),
            schedule_id: "schedule".into(),
        },
        None,
    );
}

#[test]
fn scheduled_failure_reports_diagnostic_before_exit() {
    run_worker_case(
        LaunchContext::Scheduled {
            project_id: "project".into(),
            schedule_id: "schedule".into(),
        },
        Some(StartupFailure::ScheduledTask),
    );
}
