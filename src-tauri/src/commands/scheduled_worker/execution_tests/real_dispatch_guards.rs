use super::super::execute_task;
use super::super::run_scheduled_task;
use super::{fixture, read_task, store, task};

#[tokio::test]
async fn actual_crawl_dispatch_rejects_invalid_mode_before_network() {
    let app = fixture();
    let mut manifest = task("site-crawl");
    manifest.crawl_config =
        Some(serde_json::from_value(serde_json::json!({"crawlMode":"fixture-only"})).unwrap());

    let error = execute_task(&app.handle(), "project-1", &manifest)
        .await
        .unwrap_err();

    assert_eq!(error, "Crawl mode must be either http or browser-rendered.");
}

#[tokio::test]
async fn run_scheduled_task_handles_missing_or_disabled_task() {
    let app = fixture();
    let err = run_scheduled_task(app.handle(), "project-1".into(), "missing".into())
        .await
        .unwrap_err();
    assert_eq!(err, "Scheduled task manifest was not found.");

    let mut disabled = task("page-audit");
    disabled.enabled = false;
    store(&app, &disabled);
    assert!(
        run_scheduled_task(app.handle(), "project-1".into(), "schedule-1".into())
            .await
            .is_ok()
    );
    let _ = crate::commands::scheduler::unregister_audit_wakeup(
        "project-1".into(),
        "schedule-1".into(),
    );
}

#[tokio::test]
async fn run_scheduled_task_executes_due_page_audit_calling_audit_and_rescheduling() {
    let app = fixture();
    let mut manifest = task("page-audit");
    manifest.next_run_at = "2020-01-01T00:00:00Z".into();
    manifest.url = "https://scheduled-fixture.invalid/".into();
    store(&app, &manifest);

    let res = run_scheduled_task(app.handle(), "project-1".into(), "schedule-1".into()).await;
    assert!(res.is_ok());

    let updated = read_task(&app, "schedule-1");
    assert_eq!(updated.status, "failed");
    assert_eq!(updated.run_history.len(), 1);
    let _ = crate::commands::scheduler::unregister_audit_wakeup(
        "project-1".into(),
        "schedule-1".into(),
    );
}

#[tokio::test]
async fn run_scheduled_task_executes_due_site_crawl_calling_crawl_and_rescheduling() {
    let app = fixture();
    let mut manifest = task("site-crawl");
    manifest.next_run_at = "2020-01-01T00:00:00Z".into();
    manifest.url = "https://scheduled-fixture.invalid/".into();
    store(&app, &manifest);

    let res = run_scheduled_task(app.handle(), "project-1".into(), "schedule-1".into()).await;
    assert!(res.is_ok());

    let updated = read_task(&app, "schedule-1");
    assert_eq!(updated.status, "completed");
    assert!(updated.last_error.is_none());
    assert_eq!(updated.run_history.len(), 1);
    let _ = crate::commands::scheduler::unregister_audit_wakeup(
        "project-1".into(),
        "schedule-1".into(),
    );
}
