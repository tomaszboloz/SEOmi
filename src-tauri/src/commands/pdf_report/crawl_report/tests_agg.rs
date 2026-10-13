use super::agg::{aggregate, finding_key};
use super::evidence::page_evidence;
use super::recs::recommendation;
use super::strings::recs::{GENERIC_CRITICAL, GENERIC_NOTICE, GENERIC_WARNING, RECOMMENDATIONS};
use crate::commands::pdf_report::audit_report::model::Sev;
use serde_json::json;

#[test]
fn findings_aggregate_by_type_sorted_by_severity_then_reach() {
    assert_eq!(
        finding_key("Title length is 15 characters; range 30"),
        "title length is # characters; range #"
    );
    assert_eq!(finding_key("Fetch failed: boom"), "fetch failed");
    let page = |n: usize, msgs: &[(&str, &str)]| {
        json!({"url": format!("https://e.test/{n}"), "title": "T",
        "issues": msgs.iter().map(|(s, m)| json!({"severity": s, "message": m})).collect::<Vec<_>>()})
    };
    let pages = vec![
        page(
            0,
            &[
                ("Info", "Document has no html lang attribute"),
                ("Warning", "Title length is 15 characters; range 30"),
            ],
        ),
        page(
            1,
            &[
                ("Warning", "Title length is 8 characters; range 30"),
                ("Critical", "Fetch failed: boom"),
            ],
        ),
        page(
            2,
            &[
                ("Critical", "Fetch failed: timeout"),
                ("Critical", "Fetch failed: timeout"),
            ],
        ),
    ];
    let types = aggregate(&pages);
    let order: Vec<_> = types.iter().map(|t| (t.sev, t.pages.len())).collect();
    assert_eq!(
        order,
        [(Sev::Critical, 3), (Sev::Warning, 2), (Sev::Info, 1)]
    );
    assert_eq!(types[0].headline, "Fetch failed");
    assert_eq!(types[1].headline, "Title length is N characters; range 30");
    assert!(
        types[1].pages[0].2.contains("title: T") && types[1].pages[0].2.contains("15 characters")
    );
    assert_eq!(types[2].pages[0].2, "lang: \u{2014}");
    assert!(types[0].advice.contains("server is reachable"));
}

#[test]
fn every_issue_code_has_advice_and_unknown_ones_fall_back_by_severity() {
    assert_eq!(recommendation(None, "zzz", Sev::Critical), GENERIC_CRITICAL);
    assert_eq!(recommendation(None, "zzz", Sev::Warning), GENERIC_WARNING);
    assert_eq!(recommendation(None, "zzz", Sev::Info), GENERIC_NOTICE);
    for code in [
        "crawl-missing-language",
        "crawl-duplicate-content",
        "crawl-thin-content",
        "html-doctype-missing",
        "jsonld-syntax-invalid",
        "crawl-client-redirect",
        "crawl-invalid-pagination",
        "crawl-nofollow-meta",
        "crawl-canonical-elsewhere",
    ] {
        assert!(
            !RECOMMENDATIONS.iter().all(|(f, _)| !code.contains(f)),
            "no advice for {code}"
        );
    }
    let by_code = recommendation(Some("html-duplicate-id"), "whatever", Sev::Info);
    assert!(by_code.contains("unique"));
    for (fragment, advice) in RECOMMENDATIONS {
        assert_eq!(*fragment, fragment.to_lowercase());
        assert_ne!(
            recommendation(None, fragment, Sev::Info),
            GENERIC_NOTICE,
            "{advice}"
        );
    }
}

#[test]
fn evidence_picks_the_fields_that_explain_each_message() {
    let page = json!({"title": "T", "meta_description": "D", "canonical": "c", "canonical_relation": "self", "http_status": 404,
        "request_error_kind": "dns", "meta_robots": "noindex", "word_count": 9, "h1_count": 0, "document_language": "pl",
        "images": [{"src": "a"}, {"src": "b", "alt": "x"}]});
    let all = page_evidence(
        &page,
        "title description canonical http robots thin h1 lang image",
    );
    for part in [
        "title: T",
        "meta description: D",
        "canonical: c (self)",
        "HTTP 404",
        "request error: dns",
        "meta robots: noindex",
        "9 words",
        "H1 count: 0",
        "lang: pl",
        "1 images without alt",
    ] {
        assert!(all.contains(part), "missing {part}");
    }
    assert_eq!(page_evidence(&page, "other"), "");
}
