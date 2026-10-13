use super::check::Status;
use super::ctx::Ctx;
use super::model::findings;
use super::sections::build;
use super::tests_sections::find;
use serde_json::json;

#[test]
fn missing_and_invalid_data_is_flagged_not_hidden() {
    let audit = json!({"final_url": "u", "indexability": {"status": "non-indexable", "reasons": ["Blocked", "By robots"]},
        "transport_security": {"https": false, "cookies": []}, "links": {"links": []}, "images": [],
        "structured_data": [{"data_type": "T", "format": "F", "validation_issues": [{"message": "Bad"}]}],
        "headings": {"has_valid_hierarchy": false}, "redirect_chain": [{"url": "a", "status_code": 302}],
        "http_performance": null, "response_time_ms": 5000});
    let ctx = Ctx {
        audit: &audit,
        findings: findings(&audit),
    };
    let sections = build(&ctx);
    let index = find(&sections, "Indexability", "Indexability status");
    assert_eq!(
        (index.status, index.advice.as_str()),
        (Status::Attention, "Blocked By robots")
    );
    assert_eq!(
        find(&sections, "Transport security", "Cookies").value,
        "No cookies were set"
    );
    assert_eq!(
        find(&sections, "Transport security", "Served over HTTPS").value,
        "No"
    );
    let structured = find(&sections, "Structured data", "T (F)");
    assert_eq!(
        structured.advice,
        "Fix the structured data so it validates."
    );
    assert_eq!(
        find(&sections, "Headings", "Valid heading hierarchy").status,
        Status::Attention
    );
    assert_eq!(
        find(&sections, "Redirect chain", "Hop 1").value,
        "HTTP 302: a to \u{2014}"
    );
    assert_eq!(
        find(&sections, "Performance", "Server response time").value,
        "5000 ms"
    );
    let unset = json!({"final_url": "u", "indexability": {}});
    let ctx = Ctx {
        audit: &unset,
        findings: Vec::new(),
    };
    assert_eq!(
        find(&build(&ctx), "Indexability", "Indexability status").status,
        Status::Info
    );
}
