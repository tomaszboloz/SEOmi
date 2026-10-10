use super::audit_text::audit_text_lines;
use super::crawl_resources_table::append_resources_table;
use super::crawl_tables::{
    append_images_table, append_issues_table, append_links_table, append_pages_table,
};
use super::crawl_text::crawl_text_lines;
use serde_json::json;

#[test]
fn saved_tables_render_real_values_and_missing_field_fallbacks() {
    let pages = vec![
        json!({
            "url": "https://local.test",
            "final_url": "https://local.test/home",
            "http_status": 200,
            "depth": 1,
            "response_time_ms": 12,
            "indexability_status": "Eligible",
            "redirect_stop_reason": "",
            "word_count": 42,
            "issues": [{"severity": "Warning", "message": "Missing alt"}, {}],
            "links": [{"target_url": "https://local.test/docs", "target_http_status": 200,
                "anchor_text": "Docs", "rel": "nofollow", "is_internal": true}, {}],
            "images": [{"src": "local.svg", "alt": "Logo", "http_status": 200,
                "content_length": 9, "format": "svg", "lazy_loaded": false}, {}]
        }),
        json!({}),
    ];
    let mut lines = Vec::new();
    append_pages_table(&mut lines, &pages);
    append_issues_table(&mut lines, &pages);
    append_links_table(&mut lines, &pages);
    append_images_table(&mut lines, &pages);
    assert!(lines
        .iter()
        .any(|line| line.contains("https://local.test/home")));
    assert!(lines
        .iter()
        .any(|line| line.contains("Warning | Missing alt")));
    assert!(lines.iter().any(|line| line.contains("Info | -")));
    assert!(lines
        .iter()
        .any(|line| line.contains("Docs | nofollow | yes")));
    assert!(lines
        .iter()
        .any(|line| line.contains("local.svg | Logo | 200 | 9 | svg | no")));
    assert!(lines
        .iter()
        .any(|line| line.contains("- | - | - | - | - | -")));

    let resources = vec![
        json!({"url": "https://local.test/app.css", "resource_type": "stylesheet",
        "http_status": 200, "content_type": "text/css", "content_length": 88,
        "request_error_kind": ""}),
        json!({}),
    ];
    lines.clear();
    append_resources_table(&mut lines, &resources);
    assert!(lines
        .iter()
        .any(|line| line.contains("app.css | stylesheet | 200 | text/css | 88")));
    assert!(lines
        .iter()
        .any(|line| line.ends_with("| - | - | - | - | -")));
}

#[test]
fn crawl_text_honors_selected_sections_and_saved_limits() {
    let run = json!({
        "id": "run-local", "completed_at": "2026-10-05", "scope_start_url": "https://local.test",
        "configuration": {"max_urls": 2},
        "report_template_sections": ["configuration", "pages", "resources"],
        "result": {
            "pages_crawled": 1, "health_score": 90, "critical_count": 1, "warning_count": 2,
            "duration_ms": 20, "limit_reasons": ["max_urls"], "discovery_provenance_truncated": true,
            "pages": [{"url": "https://local.test", "final_url": "https://local.test", "title": "Local",
                "http_status": 200, "issues": [{"severity": "Warning", "message": "Missing alt"}],
                "links": [{"target_url": "https://local.test/docs", "anchor_text": "Docs", "is_internal": false}],
                "images": [{"src": "local.svg", "alt": "Logo"}]}],
            "resources": [{"url": "https://local.test/app.css", "resource_type": "stylesheet"}]
        }
    });
    let lines = crawl_text_lines(&run);
    let report = lines.join("\n");
    assert!(report.contains("Limits observed: max_urls"));
    assert!(report.contains("Discovery provenance: partial"));
    assert!(report.contains("Configuration:"));
    assert!(report.contains("Pages table (all saved pages):"));
    assert!(report.contains("Resources table (all saved resources):"));
    assert!(!report.contains("Links table (all saved page links):"));

    let minimal = crawl_text_lines(
        &json!({"scope_start_url": "https://local.test", "result": {"pages": []}}),
    );
    assert!(minimal.iter().any(|line| line.contains("No page records")));
    assert!(minimal.iter().any(|line| line == "Configuration: -"));
}

#[test]
fn audit_text_reports_empty_issue_sets() {
    let lines = audit_text_lines(&json!({"final_url": "https://local.test", "issues": []}));
    assert!(lines
        .iter()
        .any(|line| line == "No issues were reported by this audit."));
}
