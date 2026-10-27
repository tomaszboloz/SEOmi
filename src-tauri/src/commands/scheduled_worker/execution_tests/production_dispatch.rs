use super::super::execute_task;
use super::super::execute_task_with;
use super::super::runner::run_scheduled_task_with;
use super::{fixture, read_task, store, task};
use serde_json::json;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

#[tokio::test]
async fn actual_page_audit_dispatch_rejects_private_url_without_network() {
    let app = fixture();
    let mut manifest = task("page-audit");
    manifest.url = "http://127.0.0.1/private".into();
    let error = execute_task(&app.handle(), "project-1", &manifest)
        .await
        .unwrap_err();
    assert!(error.starts_with("URL validation failed:"));
}

#[tokio::test]
async fn actual_crawl_dispatch_rejects_private_url_without_network() {
    let app = fixture();
    let mut manifest = task("site-crawl");
    manifest.url = "http://127.0.0.1/private".into();
    let error = execute_task(&app.handle(), "project-1", &manifest)
        .await
        .unwrap_err();
    assert_eq!(
        error,
        "Access to local/private IP addresses is blocked for security (SSRF prevention)"
    );
}

#[tokio::test]
async fn actual_dispatch_rejects_browser_mode_and_unknown_tasks() {
    let app = fixture();
    let mut manifest = task("site-crawl");
    manifest.crawl_config =
        Some(serde_json::from_value(serde_json::json!({"crawlMode":"browser-rendered"})).unwrap());
    let error = execute_task(&app.handle(), "project-1", &manifest)
        .await
        .unwrap_err();
    assert!(error.contains("interactive desktop WebView"));
    manifest.task_type = "unsupported".into();
    assert_eq!(
        execute_task(&app.handle(), "project-1", &manifest)
            .await
            .unwrap_err(),
        "Unsupported scheduled task type."
    );
}

#[tokio::test]
async fn injected_dispatchers_cover_page_audit_and_site_crawl_without_network() {
    for task_type in ["page-audit", "site-crawl"] {
        let mut manifest = task(task_type);
        manifest.url = format!("fixture://{task_type}");
        let result = if task_type == "page-audit" {
            execute_task_with(
                manifest,
                |url| async move { Ok(json!({"kind":"page-audit", "url":url})) },
                |_| async { panic!("page-audit must not call crawl executor") },
            )
            .await
        } else {
            execute_task_with(
                manifest,
                |_| async { panic!("site-crawl must not call audit executor") },
                |task| async move { Ok(json!({"kind":"site-crawl", "url":task.url})) },
            )
            .await
        }
        .unwrap();
        assert_eq!(result["kind"], task_type);
        assert_eq!(result["url"], format!("fixture://{task_type}"));
    }
}

#[tokio::test]
async fn actual_worker_keeps_future_manifest_unchanged_and_creates_no_handoff() {
    let app = fixture();
    let mut manifest = task("page-audit");
    manifest.next_run_at = "2999-09-25T01:00:00Z".into();
    store(&app, &manifest);
    super::super::run_scheduled_task(app.handle(), "project-1".into(), "schedule-1".into())
        .await
        .unwrap();
    assert_eq!(
        serde_json::to_value(read_task(&app, "schedule-1")).unwrap(),
        serde_json::to_value(manifest).unwrap()
    );
    let handoff =
        super::super::super::storage::execution_path(&app.handle(), "project-1", "schedule-1")
            .unwrap();
    assert!(!handoff.exists());
}

#[tokio::test]
async fn worker_persists_injected_results_without_network() {
    for task_type in ["page-audit", "site-crawl"] {
        let app = fixture();
        let mut manifest = task(task_type);
        manifest.next_run_at = "2020-01-01T00:00:00Z".into();
        store(&app, &manifest);
        run_scheduled_task_with(
            app.handle(),
            "project-1".into(),
            "schedule-1".into(),
            move |task| async move { Ok(json!({"fixture":true, "kind":task.task_type})) },
            |_, _, _, _| Ok(()),
            |_, _| Ok(()),
        )
        .await
        .unwrap();
        let updated = read_task(&app, "schedule-1");
        assert_eq!(updated.status, "completed");
        assert!(updated.run_history[0].succeeded);
    }
}

#[tokio::test]
async fn actual_worker_unregisters_disabled_task_without_executing() {
    let app = fixture();
    let mut manifest = task("page-audit");
    manifest.enabled = false;
    store(&app, &manifest);
    let unregisters = Arc::new(AtomicUsize::new(0));
    let seen = unregisters.clone();
    run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { panic!("disabled task must not execute") },
        |_, _, _, _| panic!("disabled task must not register"),
        move |project, schedule| {
            assert_eq!(
                (project.as_str(), schedule.as_str()),
                ("project-1", "schedule-1")
            );
            seen.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
    )
    .await
    .unwrap();
    assert_eq!(unregisters.load(Ordering::SeqCst), 1);
    assert!(!read_task(&app, "schedule-1").enabled);
}
