#[path = "tests_pdf_extract.rs"]
mod tests_pdf_extract;

#[path = "font_layout_branch_tests.rs"]
mod font_layout_branch_tests;

pub(super) use tests_pdf_extract::{extract_pdf_text, pdf_has_text};

use crate::commands::pdf_report::{generate_audit_pdf, generate_crawl_pdf};
use base64::Engine;

#[test]
fn creates_a_valid_pdf_payload_from_an_audit() {
    let encoded = generate_audit_pdf(serde_json::json!({ "final_url": "https://example.com", "health_score": 80, "issues": [{ "severity": "Warning", "category": "Technical", "message": "Missing title" }] })).unwrap();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .unwrap();
    assert!(bytes.starts_with(b"%PDF-1.4"));
    assert!(pdf_has_text(&bytes, "Missing title"));
    assert!(pdf_has_text(&bytes, "Page 1 of"));
}

#[test]
fn creates_a_crawl_pdf_from_the_saved_run_without_refetching_pages() {
    let encoded = generate_crawl_pdf(serde_json::json!({
        "id": "run-1",
        "completed_at": "2026-09-22T12:00:00Z",
        "scope_start_url": "https://example.com",
        "configuration": {"maxPages": 100},
        "result": {
            "pages_crawled": 1, "health_score": 80, "critical_count": 1, "warning_count": 0,
            "duration_ms": 123,
            "pages": [{"url": "https://example.com", "final_url": "https://example.com", "title": "Example",
                "http_status": 200, "depth": 0, "response_time_ms": 12, "word_count": 42,
                "redirect_stop_reason": "exceeded",
                "issues": [{"severity": "Critical", "message": "Missing canonical"}]}],
            "resources": [{"url": "https://example.com/app.css", "resource_type": "stylesheet", "http_status": 200}]
        }
    })).unwrap();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .unwrap();
    assert!(bytes.starts_with(b"%PDF-1.4"));
    for part in [
        "Missing canonical",
        "exceeded",
        "https://example.com/app.css",
        "maxPages",
        "Page 1 of",
    ] {
        assert!(pdf_has_text(&bytes, part), "missing {part}");
    }
}

#[test]
fn rejects_crawl_pdf_without_scope_url() {
    assert!(generate_crawl_pdf(serde_json::json!({"result": {}})).is_err());
}
