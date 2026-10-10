use super::{fixture, read_task, store, task};

#[tokio::test]
async fn actual_worker_executes_due_page_audit_task_rejecting_private_url() {
    let app = fixture();
    let mut manifest = task("page-audit");
    manifest.next_run_at = "2020-01-01T00:00:00Z".into();
    manifest.url = "http://127.0.0.1/private".into();
    store(&app, &manifest);

    let error =
        super::super::run_scheduled_task(app.handle(), "project-1".into(), "schedule-1".into())
            .await
            .unwrap_err();
    assert_eq!(
        error,
        "Invalid scheduled URL: Access to local/private IP addresses is blocked for security (SSRF prevention)"
    );

    let updated = read_task(&app, "schedule-1");
    assert_eq!(updated.status, "scheduled");
    assert!(updated.run_history.is_empty());
    let handoff =
        super::super::super::storage::execution_path(&app.handle(), "project-1", "schedule-1")
            .unwrap();
    assert!(!handoff.exists());

    let _ = crate::commands::scheduler::unregister_audit_wakeup(
        "project-1".into(),
        "schedule-1".into(),
    );
}

#[tokio::test]
async fn actual_worker_executes_due_site_crawl_task_rejecting_private_url() {
    let app = fixture();
    let mut manifest = task("site-crawl");
    manifest.next_run_at = "2020-01-01T00:00:00Z".into();
    manifest.url = "http://127.0.0.1/private".into();
    store(&app, &manifest);

    let error =
        super::super::run_scheduled_task(app.handle(), "project-1".into(), "schedule-1".into())
            .await
            .unwrap_err();
    assert_eq!(
        error,
        "Invalid scheduled URL: Access to local/private IP addresses is blocked for security (SSRF prevention)"
    );

    let updated = read_task(&app, "schedule-1");
    assert_eq!(updated.status, "scheduled");
    assert!(updated.run_history.is_empty());
    let handoff =
        super::super::super::storage::execution_path(&app.handle(), "project-1", "schedule-1")
            .unwrap();
    assert!(!handoff.exists());

    let _ = crate::commands::scheduler::unregister_audit_wakeup(
        "project-1".into(),
        "schedule-1".into(),
    );
}
