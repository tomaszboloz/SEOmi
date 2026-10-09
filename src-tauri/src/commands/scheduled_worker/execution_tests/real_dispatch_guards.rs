use super::super::execute_task;
use super::{fixture, task};

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
