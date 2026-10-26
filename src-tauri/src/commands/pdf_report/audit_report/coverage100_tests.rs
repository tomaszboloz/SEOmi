use super::{audit_pdf, ctx::field, locate::where_items, model::findings, sections};
use serde_json::{json, Value};

fn edge_audit() -> Value {
    json!({
        "final_url": "https://example.test/page", "timestamp": "2026-10-13T17:30:39Z",
        "health_score": 49, "http_status": 302, "response_time_ms": 1200,
        "meta_tags": {"title": "Example", "title_length": 7, "description": "Desc",
            "description_length": 4, "canonical": "https://example.test/", "robots": "noindex",
            "viewport": "width=device-width", "charset": "utf-8"},
        "headings": {"h1_count": 1, "h1_texts": ["One"],
            "has_valid_hierarchy": false, "issues": ["h1 to h3"],
            "hierarchy": [{"level": 1, "text": "One", "children": [{"level": 3, "text": "Child", "children": []}]}]},
        "content_stats": {"word_count": 10, "top_keywords": [{"keyword": "seo", "count": 2}]},
        "images": [{"src": "a.png", "has_alt": false, "width": null, "height": 10},
            {"src": "missing-height.png", "has_alt": true, "width": 10, "height": null}],
        "links": {"total_links": 2, "internal_links": 1, "external_links": 1,
            "links": [{"href": "http://bad.test", "is_insecure": true, "target": "_blank"}]},
        "redirect_chain": [{"status_code": 301, "location": "https://example.test/"}],
        "indexability": {"status": "blocked", "reasons": ["xrobots"], "x_robots_tag": "noindex"},
        "security_headers": {"score": 50, "content_security_policy": "default-src 'self'"},
        "transport_security": {"https": false, "scheme": "http", "cookies": [
            {"name": "ok", "secure": true, "http_only": true, "same_site": "Lax"},
            {"name": "bad", "secure": false, "http_only": false}]},
        "structured_data": [{"data_type": "Article", "format": "JSON-LD", "validation_issues": []}],
        "open_graph": {"og_title": "Example"}, "twitter_card": {},
        "accessibility": {"findings": []}, "amp": {"detected": false},
        "technical": {"server": "nginx"},
        "issues": [
            {"severity": "Warning", "category": "MetaTags", "code": "meta_title_short", "recommendation": "Fix title"},
            {"severity": "Warning", "category": "Cookies", "code": "cookie_missing", "recommendation": "Secure cookie"},
            {"severity": "Info", "category": "Headings", "code": "headings_hierarchy_skip", "message": "Skip"},
            {"severity": "Critical", "category": "Indexability", "code": "indexability_xrobots", "params": {"value": "noindex"}}
        ]
    })
}

#[test]
fn audit_edges_cover_nested_sections_and_empty_values() {
    let audit = edge_audit();
    assert_eq!(
        field(&json!({"n": 7, "flag": true, "blank": "  "}), "n"),
        Some("7".into())
    );
    assert_eq!(
        field(&json!({"n": 7, "flag": true, "blank": "  "}), "flag"),
        Some("true".into())
    );
    let xrobots = where_items(&audit, "indexability_xrobots", None);
    assert_eq!(xrobots.len(), 3);
    assert!(xrobots.iter().any(|item| item.contains("X-Robots-Tag")));
    assert!(xrobots.iter().any(|item| item.contains("noindex")));
    assert!(where_items(&audit, "headings_hierarchy_skip", None)
        .iter()
        .any(|item| item.contains("h1 to h3")));
    assert!(where_items(&audit, "images_dimensions", None)
        .iter()
        .any(|item| item.contains("missing-height.png")));

    let sections = sections::build(&super::ctx::Ctx {
        audit: &audit,
        findings: findings(&audit),
    });
    assert!(!sections.is_empty());
    let bytes = audit_pdf(&audit);
    assert!(bytes.starts_with(b"%PDF-1.4"));

    // A present section with no passing checks exercises the explicit empty summary.
    let minimal = json!({"final_url": "https://example.test", "meta_tags": {}});
    let bytes = audit_pdf(&minimal);
    assert!(bytes.starts_with(b"%PDF-1.4"));
}
