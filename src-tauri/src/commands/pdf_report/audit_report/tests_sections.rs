use super::check::{Check, Status};
use super::ctx::Ctx;
use super::model::findings;
use super::sections::build;
use serde_json::{json, Value};

fn rich() -> Value {
    json!({
        "final_url": "https://example.test/", "http_status": 200, "response_time_ms": 300,
        "meta_tags": {"title": "A fine title", "title_length": 12.0, "description": "Desc", "description_length": 4,
            "canonical": "https://example.test/", "robots": "index", "viewport": "width=device-width", "charset": "utf-8"},
        "headings": {"h1_count": 1, "h1_texts": ["Main"], "has_valid_hierarchy": true, "issues": [], "hierarchy": []},
        "content_stats": {"word_count": 94, "sentence_count": 9, "reading_time_minutes": 1, "readability_label": "easy",
            "readability_ease_score": 71.5, "average_words_per_sentence": 10.4, "text_ratio_percent": 11.3,
            "top_keywords": [{"keyword": "domains", "count": 5}]},
        "images": [{"src": "a.svg", "has_alt": true, "width": "1", "height": "1", "format": "svg"}, {"src": "b", "has_alt": true, "width": "1", "height": "1"}],
        "links": {"total_links": 1, "internal_links": 1, "external_links": 0, "nofollow_links": 0, "links": [
            {"href": "/a", "text": "A", "target": "_blank", "rel": "noopener"}]},
        "redirect_chain": [],
        "indexability": {"status": "indexable", "reasons": [], "canonical_target_status": 200, "canonical_matches_final_url": true},
        "security_headers": {"score": 100},
        "transport_security": {"https": true, "scheme": "https", "mixed_content_urls": [], "cookies": [
            {"name": "ok", "secure": true, "http_only": true, "same_site": "Lax"}]},
        "structured_data": [{"data_type": "Org", "format": "JSON-LD", "validation_issues": []}],
        "open_graph": {"og_title": "t", "og_description": "d", "og_image": "i"}, "twitter_card": {"twitter_card": "summary"},
        "accessibility": {"document_language": "en", "landmarks": [{"name": "main", "count": 1}], "aria_attribute_count": 2,
            "findings": [{"code": "a11y-info", "severity": "info", "message": "Consider skip link", "evidence": "none", "recommendation": "Add one"}]},
        "amp": {"detected": true, "is_amp_document": true, "amphtml_urls": ["https://example.test/amp"],
            "canonical_url": "https://example.test/", "coverage": "partial", "findings": [
            {"code": "amp-x", "severity": "error", "message": "AMP problem", "evidence": "e", "recommendation": "Fix AMP"}]},
        "http_performance": {"response_headers_ms": 10, "body_read_ms": 1, "total_request_ms": 11, "decoded_body_bytes": 500,
            "content_length_header_bytes": 480, "redirect_hops": 0, "method": "GET", "measured_at": "now", "scope": "http"},
        "technical": {"content_type": "text/html", "server": "nginx", "favicon": "/f.ico", "robots_txt_url": "/robots.txt",
            "sitemap_url": "/sitemap.xml", "hreflang_tags": [{"hreflang": "en", "href": "https://example.test/en"}],
            "technology_signals": [{"name": "Vue", "category": "Framework", "confidence": "likely"}]},
        "issues": []
    })
}

pub(super) fn find(sections: &[super::check::Section], title: &str, name: &str) -> Check {
    let section = sections
        .iter()
        .find(|section| section.title == title)
        .unwrap();
    section
        .checks
        .iter()
        .find(|check| check.name == name)
        .unwrap()
        .clone()
}

#[test]
fn healthy_audits_pass_their_checks_and_show_every_value() {
    let audit = rich();
    let ctx = Ctx {
        audit: &audit,
        findings: findings(&audit),
    };
    let sections = build(&ctx);
    assert_eq!(sections.len(), 15);
    let ok = |title: &str, name: &str| {
        assert_eq!(find(&sections, title, name).status, Status::Ok, "{name}")
    };
    ok("Meta tags", "Title");
    ok("Meta tags", "Meta description");
    ok("Headings", "H1 count");
    ok("Headings", "Valid heading hierarchy");
    ok("Indexability", "Indexability status");
    ok("Transport security", "Cookie: ok");
    ok("Structured data", "Org (JSON-LD)");
    ok("Open Graph and Twitter card", "twitter:card");
    ok("Accessibility", "Document language");
    ok("Images", "Images without alt text");
    ok("Performance", "Server response time");
    assert_eq!(
        find(&sections, "Meta tags", "Title").value,
        "A fine title (12 characters)"
    );
    assert_eq!(
        find(&sections, "Content statistics", "Readability").value,
        "easy (Flesch score 71.5)"
    );
    assert_eq!(
        find(&sections, "Content statistics", "Top keywords").value,
        "domains (5)"
    );
    assert_eq!(
        find(&sections, "Content statistics", "Reading time").value,
        "1 min"
    );
    assert_eq!(
        find(&sections, "Images", "Image formats").value,
        "svg (1), unknown (1)"
    );
    assert_eq!(
        find(&sections, "Performance", "Decoded body size").value,
        "500 bytes"
    );
    assert_eq!(
        find(&sections, "Technical details", "Hreflang tags").value,
        "en: https://example.test/en"
    );
    assert_eq!(
        find(&sections, "Technical details", "Detected technologies").value,
        "Vue (Framework, likely)"
    );
    assert_eq!(
        find(&sections, "Accessibility", "Landmarks").value,
        "main (1)"
    );
    assert_eq!(
        find(&sections, "AMP", "AMP versions linked").value,
        "https://example.test/amp"
    );
}

#[test]
fn accessibility_and_amp_findings_become_rows_with_their_severity() {
    let audit = rich();
    let ctx = Ctx {
        audit: &audit,
        findings: findings(&audit),
    };
    let sections = build(&ctx);
    let hint = find(&sections, "Accessibility", "Consider skip link");
    assert_eq!(
        (hint.status, hint.advice.as_str(), hint.value.as_str()),
        (Status::Info, "Add one", "none")
    );
    let amp = find(&sections, "AMP", "AMP problem");
    assert_eq!(
        (amp.status, amp.advice.as_str()),
        (Status::Attention, "Fix AMP")
    );
}
