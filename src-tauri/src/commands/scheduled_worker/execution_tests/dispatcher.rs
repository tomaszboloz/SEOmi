use super::super::execute_task_with;
use super::task;
use serde_json::{json, Value};

#[tokio::test]
async fn dispatcher_routes_page_audit_and_site_crawl_to_the_matching_executor() {
    let audit = execute_task_with(
        task("page-audit"),
        |url| async move { Ok(json!({"branch":"audit", "url":url})) },
        |_| async { Err::<Value, _>("crawl callback must not run".into()) },
    )
    .await
    .unwrap();
    assert_eq!(audit["branch"], "audit");
    assert_eq!(audit["url"], "https://example.test");

    let crawl = execute_task_with(
        task("site-crawl"),
        |_| async { Err::<Value, _>("audit callback must not run".into()) },
        |value| async move { Ok(json!({"branch":"crawl", "url":value.url})) },
    )
    .await
    .unwrap();
    assert_eq!(crawl["branch"], "crawl");
    assert_eq!(crawl["url"], "https://example.test");
}

#[tokio::test]
async fn dispatcher_rejects_browser_rendered_and_unknown_tasks_before_callbacks() {
    let mut browser = task("site-crawl");
    browser.crawl_config = Some(
        serde_json::from_value(json!({
            "crawlMode":"browser-rendered"
        }))
        .unwrap(),
    );
    let error = execute_task_with(
        browser,
        |_| async { Err::<Value, _>("unexpected audit".into()) },
        |_| async { Err::<Value, _>("unexpected crawl".into()) },
    )
    .await
    .unwrap_err();
    assert!(error.contains("interactive desktop WebView"));

    let error = execute_task_with(
        task("unsupported"),
        |_| async { Err::<Value, _>("unexpected audit".into()) },
        |_| async { Err::<Value, _>("unexpected crawl".into()) },
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Unsupported scheduled task type.");
}

#[tokio::test]
async fn dispatcher_preserves_executor_errors_for_audit_and_crawl() {
    let audit_error = execute_task_with(
        task("page-audit"),
        |_| async { Err::<Value, _>("audit fixture failed".into()) },
        |_| async { panic!("crawl executor must not run") },
    )
    .await
    .unwrap_err();
    assert_eq!(audit_error, "audit fixture failed");

    let crawl_error = execute_task_with(
        task("site-crawl"),
        |_| async { panic!("audit executor must not run") },
        |_| async { Err::<Value, _>("crawl fixture failed".into()) },
    )
    .await
    .unwrap_err();
    assert_eq!(crawl_error, "crawl fixture failed");
}
