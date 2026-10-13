use serde_json::{json, Value};

pub(super) fn fixture() -> Value {
    json!({
        "final_url": "https://example.test/page",
        "timestamp": "2026-10-13T17:30:39.256547Z",
        "http_status": 200, "response_time_ms": 1200, "health_score": 53,
        "meta_tags": {"title": "Example", "title_length": 7, "description": null,
            "description_length": 0, "canonical": null, "viewport": "width=device-width"},
        "headings": {"h1_count": 2, "h1_texts": ["One", "Two"], "has_valid_hierarchy": false,
            "issues": ["Heading level skipped: h1 to h3"], "hierarchy": [
            {"level": 1, "text": "One", "children": [{"level": 2, "text": "Sub", "children": []}]}]},
        "images": [{"src": "https://cdn.test/a.png", "has_alt": false, "width": null, "height": "10", "format": "png"}],
        "links": {"total_links": 2, "internal_links": 1, "external_links": 1, "nofollow_links": 0, "links": [
            {"href": "http://insecure.test/", "text": "Old", "is_insecure": true, "target": "_blank", "rel": null}]},
        "redirect_chain": [{"url": "http://example.test/", "status_code": 301, "location": "https://example.test/"}],
        "indexability": {"status": "uncertain", "reasons": ["No canonical."], "canonical_target_checked": false},
        "security_headers": {"score": 40, "content_security_policy": "default-src 'self' 'unsafe-inline'", "x_frame_options": "DENY"},
        "transport_security": {"https": true, "scheme": "https", "mixed_content_urls": [], "cookies": [
            {"name": "sid", "secure": false, "http_only": true, "same_site": null}]},
        "structured_data": [{"data_type": "Article", "format": "JSON-LD", "validation_issues": [
            {"message": "Missing headline", "path": "$.headline", "recommendation": "Add headline"}]}],
        "open_graph": {"og_title": "Example"}, "twitter_card": {},
        "accessibility": {"findings": [{"code": "accessibility-x", "severity": "warning", "message": "Button has no name",
            "evidence": "No label", "recommendation": "Name it", "elements": [
            {"dom_query": "main > button", "html_snippet": "<button></button>", "line": 4, "column": 2}]}],
            "manual_review_items": ["Check contrast"]},
        "amp": {"detected": false, "findings": [], "unchecked": ["Validator rules"]},
        "http_performance": {"response_headers_ms": 1100, "total_request_ms": 1200},
        "technical": {"server": "nginx", "technology_signals": [{"name": "jQuery", "version": "3.1", "category": "JavaScript library", "confidence": "confirmed"}]},
        "issues": [
            {"severity": "Info", "category": "Images", "code": "images_alt_missing", "message": "Image missing alt", "recommendation": "Add alt text"},
            {"severity": "Critical", "category": "MetaTags", "code": "meta_description_missing", "message": "Missing meta description tag", "recommendation": "Add a description"},
            {"severity": "Warning", "category": "Security", "code": "security_csp_unsafe", "message": "CSP allows unsafe-inline", "recommendation": "Restrict sources"},
            {"severity": "Warning", "category": "Technical", "message": "Something odd"}
        ]
    })
}
