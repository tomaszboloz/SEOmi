//! Production startup orchestration with an injectable side-effect boundary.
//!
//! The launch context is resolved once, before setup starts.  A headless worker
//! always hides the main window, finishes its work, reports failure when one
//! occurred, and exits with code zero so the durable worker result is the
//! source of truth.  Callers inject those side effects here so MockRuntime can
//! assert the contract without invoking OS launch services.

use std::{future::Future, sync::Arc};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum LaunchContext {
    Interactive,
    AuditQueue {
        project_id: String,
        run_id: String,
    },
    Scheduled {
        project_id: String,
        schedule_id: String,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum StartupFailure {
    AuditQueue,
    ScheduledTask,
}

pub(crate) fn launch_context(args: &[String]) -> LaunchContext {
    if let Some((project_id, run_id)) =
        crate::commands::scheduler::worker_launch_context(args, "--seomi-audit-queue-headless")
    {
        return LaunchContext::AuditQueue { project_id, run_id };
    }
    if let Some((project_id, schedule_id)) =
        crate::commands::scheduler::worker_launch_context(args, "--seomi-scheduled-headless")
    {
        return LaunchContext::Scheduled {
            project_id,
            schedule_id,
        };
    }
    LaunchContext::Interactive
}

pub(crate) fn start_with<R, Q, QF, S, SF, H, D, E>(
    app: &mut tauri::App<R>,
    context: LaunchContext,
    run_queue: Q,
    run_scheduled: S,
    hide_window: H,
    diagnostic: D,
    exit: E,
) -> tauri::Result<()>
where
    R: Runtime,
    Q: FnOnce(AppHandle<R>, String, String) -> QF + Send + 'static,
    QF: Future<Output = Result<(), String>> + Send + 'static,
    S: FnOnce(AppHandle<R>, String, String) -> SF + Send + 'static,
    SF: Future<Output = Result<(), String>> + Send + 'static,
    H: Fn(&AppHandle<R>),
    D: Fn(StartupFailure) + Send + Sync + 'static,
    E: Fn(AppHandle<R>, i32) + Send + Sync + 'static,
{
    let handle = app.handle().clone();
    match context {
        LaunchContext::Interactive => {}
        LaunchContext::AuditQueue { project_id, run_id } => {
            hide_window(&handle);
            let diagnostic: Arc<dyn Fn(StartupFailure) + Send + Sync> = Arc::new(diagnostic);
            let exit: Arc<dyn Fn(AppHandle<R>, i32) + Send + Sync> = Arc::new(exit);
            tauri::async_runtime::spawn(async move {
                if run_queue(handle.clone(), project_id, run_id).await.is_err() {
                    diagnostic(StartupFailure::AuditQueue);
                }
                exit(handle, 0);
            });
        }
        LaunchContext::Scheduled {
            project_id,
            schedule_id,
        } => {
            hide_window(&handle);
            let diagnostic: Arc<dyn Fn(StartupFailure) + Send + Sync> = Arc::new(diagnostic);
            let exit: Arc<dyn Fn(AppHandle<R>, i32) + Send + Sync> = Arc::new(exit);
            tauri::async_runtime::spawn(async move {
                if run_scheduled(handle.clone(), project_id, schedule_id)
                    .await
                    .is_err()
                {
                    diagnostic(StartupFailure::ScheduledTask);
                }
                exit(handle, 0);
            });
        }
    }
    Ok(())
}

pub(crate) async fn run_audit_queue_task<R: Runtime>(
    handle: AppHandle<R>,
    project_id: String,
    run_id: String,
) -> Result<(), String> {
    crate::commands::audit_queue_worker::run_audit_queue(handle, project_id, run_id).await
}

pub(crate) async fn run_scheduled_worker_task<R: Runtime>(
    handle: AppHandle<R>,
    project_id: String,
    schedule_id: String,
) -> Result<(), String> {
    crate::commands::scheduled_worker::run_scheduled_task(handle, project_id, schedule_id).await
}

pub(crate) fn hide_main_window<R: Runtime>(handle: &AppHandle<R>) {
    if let Some(window) = handle.get_webview_window("main") {
        let _ = window.hide();
    }
}

pub(crate) fn handle_startup_failure(failure: StartupFailure) {
    match failure {
        StartupFailure::AuditQueue => {
            crate::utils::logging::diagnostic(crate::utils::logging::Diagnostic::AuditQueueFailed)
        }
        StartupFailure::ScheduledTask => crate::utils::logging::diagnostic(
            crate::utils::logging::Diagnostic::ScheduledTaskFailed,
        ),
    }
}

pub(crate) fn exit_app<R: Runtime>(handle: AppHandle<R>, code: i32) {
    handle.exit(code);
}
