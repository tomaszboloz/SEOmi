use crate::commands::pdf_report::{generate_audit_pdf, generate_crawl_pdf};
use base64::Engine;

#[test]
fn creates_a_valid_pdf_payload_from_an_audit() {
    let encoded = generate_audit_pdf(serde_json::json!({ "final_url": "https://example.com", "health_score": 80, "issues": [{ "severity": "Warning", "category": "Technical", "message": "Missing title" }] })).unwrap();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .unwrap();
    assert!(bytes.starts_with(b"%PDF-1.4"));
    assert!(String::from_utf8_lossy(&bytes).contains("Missing title"));
    assert!(String::from_utf8_lossy(&bytes).contains("Crawl metrics - saved run"));
}

#[test]
fn creates_a_crawl_pdf_from_the_saved_run_without_refetching_pages() {
    let encoded = generate_crawl_pdf(serde_json::json!({
        "id": "run-1",
        "completed_at": "2026-09-22T12:00:00Z",
        "scope_start_url": "https://example.com",
        "configuration": {"max_urls": 100},
        "result": {
            "pages_crawled": 1,
            "health_score": 80,
            "critical_count": 1,
            "warning_count": 0,
            "duration_ms": 123,
            "pages": [{"url": "https://example.com", "final_url": "https://example.com", "title": "Example", "http_status": 200, "depth": 0, "response_time_ms": 12, "indexability_status": "Eligible", "redirect_stop_reason": "redirect limit of 10 exceeded", "word_count": 42, "issues": [{"severity": "Critical", "message": "Missing canonical"}], "links": [{"target_url": "https://example.com/docs", "anchor_text": "Docs", "is_internal": true, "target_http_status": 200}], "images": [{"src": "https://example.com/logo.webp", "alt": "Logo", "format": "webp", "lazy_loaded": false, "http_status": 200, "content_length": 1234}]}],
            "resources": [{"url": "https://example.com/app.css", "resource_type": "stylesheet", "http_status": 200, "content_type": "text/css", "content_length": 88}]
        }
    })).unwrap();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .unwrap();
    let report = String::from_utf8_lossy(&bytes);
    assert!(bytes.starts_with(b"%PDF-1.4"));
    assert!(report.contains("Missing canonical"));
    assert!(report.contains("Pages table \\(all saved pages\\):"));
    assert!(report.contains("Redirect stop reason: redirect limit of 10 exceeded"));
    assert!(report.contains("Redirect stop reason"));
    assert!(report.contains("Links table \\(all saved page links\\):"));
    assert!(report.contains("Images table \\(all saved page images\\):"));
    assert!(report.contains("Resources table \\(all saved resources\\):"));
    assert!(report.contains("https://example.com/app.css"));
    assert!(report.contains("Configuration:"));
    assert!(report.contains("Crawl metrics - saved run"));
    assert!(report.contains("re f"));
}

#[test]
fn applies_report_template_sections_to_the_pdf_tables() {
    let encoded = generate_crawl_pdf(serde_json::json!({
        "id": "run-template",
        "scope_start_url": "https://example.com",
        "configuration": {"max_urls": 1},
        "report_template_sections": ["summary", "issues"],
        "result": {
            "pages_crawled": 1,
            "health_score": 90,
            "critical_count": 0,
            "warning_count": 1,
            "duration_ms": 10,
            "pages": [{"url": "https://example.com", "final_url": "https://example.com", "title": "Example", "http_status": 200, "issues": [{"severity": "Warning", "message": "Missing description"}], "links": [{"target_url": "https://example.com/docs", "anchor_text": "Docs", "is_internal": true}], "images": [{"src": "https://example.com/logo.webp", "alt": "Logo"}]}]
        }
    })).unwrap();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .unwrap();
    let report = String::from_utf8_lossy(&bytes);
    assert!(report.contains("Issues table \\(all saved findings\\):"));
    assert!(!report.contains("Pages table \\(all saved pages\\):"));
    assert!(!report.contains("Links table \\(all saved page links\\):"));
    assert!(!report.contains("Images table \\(all saved page images\\):"));
}

#[test]
fn rejects_crawl_pdf_without_scope_url() {
    assert!(generate_crawl_pdf(serde_json::json!({"result": {}})).is_err());
}
