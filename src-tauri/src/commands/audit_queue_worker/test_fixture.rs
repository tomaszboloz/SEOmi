use crate::models::audit_data::{HttpPerformanceMeasurement, PageAuditData};
use crate::services::{http_client::FetchResult, seo_analyzer::analyze_page};
use chrono::{Duration, Utc};
use serde_json::{json, Value};

pub(super) fn snapshot(run: &str) -> Value {
    let old = (Utc::now() - Duration::minutes(6)).to_rfc3339();
    json!({"items":[
        {"id":"first","url":"https://example.test/first","status":"queued"},
        {"id":"second","url":"https://example.test/second","status":"queued"}
    ],"run":{"id":run,"status":"running","startedAt":old,"updatedAt":old}})
}

// Typed synthetic page observations are analyzed through the real analyzer.
// No live HTTP or WebView claim is made by this inspector fixture.
pub(super) async fn audit(url: String) -> Result<PageAuditData, String> {
    analyze_page(FetchResult {
        url: url.clone(), final_url: url, status: 200, response_time_ms: 17,
        headers: Default::default(), repeated_headers: Default::default(), set_cookie_headers: vec![], redirect_chain: vec![],
        body: "<html><head><title>Queue fixture</title></head><body><h1>Observed title</h1></body></html>".into(),
        http_performance: HttpPerformanceMeasurement {
            measured_at: Utc::now(), method: "GET".into(), response_headers_ms: 12,
            body_read_ms: 5, total_request_ms: 17, decoded_body_bytes: 109,
            content_length_header_bytes: None, redirect_hops: 0, scope: "test_fixture".into(),
        },
    }).await.map_err(|error| error.to_string())
}

/// Execute the real orchestration without mutating host scheduler jobs.
pub(super) async fn run_audit_queue_with<R, F, Fut>(
    app: tauri::AppHandle<R>,
    project_id: String,
    run_id: String,
    inspect: F,
) -> Result<(), String>
where
    R: tauri::Runtime,
    F: Fn(String, Option<String>) -> Fut,
    Fut: std::future::Future<Output = Result<PageAuditData, String>>,
{
    super::execution::run_audit_queue_with(app, project_id, run_id, inspect, |_, _| {}).await
}
