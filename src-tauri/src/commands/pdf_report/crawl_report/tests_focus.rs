use super::fixture::synthetic;
use super::sec_focus::present;
use super::tests::text_of;
use serde_json::{json, Value};

pub(super) fn focus() -> Value {
    json!({
        "score": 62.4, "band": "moderate", "confidence": 71.2, "on_topic_ratio": 80, "page_count": 40,
        "core_topic": {"label": "diabetes care", "terms": [
            {"term": "insulin", "coverage_pct": 64.5}, {"term": "glucose", "coverage_pct": 50}]},
        "flags": {"low_confidence": false, "multi_topic": true, "lexical_fallback": true,
            "degraded": true, "skipped_render_timeouts": 3},
        "counts": {"scored": 37, "skipped": 3, "off_topic": 4, "borderline": 6, "strong": 20},
        "pages": [
            {"url": "https://shop.example.test/phones/review-1", "type": "article", "trs": 12.5,
             "similarity": 10, "overlap": 8, "drift": 77.5, "status": "off-topic",
             "playbook": {"type": "A", "options": [
                {"code": "remove-redirect", "params": {"gain": 2.5}},
                {"code": "rewrite-on-topic", "params": {"target": 82}}]}},
            {"url": "https://shop.example.test/b", "type": "category", "trs": 65, "similarity": 60,
             "overlap": 50, "drift": 20, "status": "moderate",
             "playbook": {"type": "B", "options": [{"code": "add-missing-terms", "params": {"terms": "insulin, glucose"}}]}},
            {"url": "https://shop.example.test/c", "type": "homepage", "trs": 90, "status": "strong",
             "playbook": {"type": "C", "options": [{"code": "unknown-code", "params": {}}]}}
        ],
        "recommendations": [
            {"code": "remove-offtopic", "params": {"count": 4, "gain": 6.5}, "gain": 6.5},
            {"code": "split-subsites", "params": {"count": 3}, "gain": 0}],
        "sub_sites": [{"label": "Phones", "path_prefix": "/phones", "share_pct": 30, "score": 91.5}],
        "gaps": [
            {"code": "thin-subtopic", "label": "foot care", "terms": ["foot care", "neuropathy"], "coverage_pct": 5, "pages_covering": 2},
            {"code": "competitor-terms", "label": "cgm", "terms": ["cgm", "libre"], "coverage_pct": 0, "pages_covering": 0}]
    })
}

pub(super) fn with_focus(focus: Value) -> Value {
    let mut run = synthetic(12);
    run["focus"] = focus;
    run
}

#[test]
fn focus_section_shows_score_core_topic_pages_recommendations_and_gaps() {
    let text = text_of(&with_focus(focus()));
    for part in [
        "Site Focus",
        "Site Focus Score",
        "Moderate focus",
        "62",
        "CORE TOPIC",
        "diabetes care",
        "insulin (64.5% of pages)",
        "Confidence 71.2%",
        "Core topic confidence",
        "On-topic ratio",
        "Off-topic pages",
        "Strong pages",
        "Weakest pages by topic relevance",
        "phones/review-1",
        "Strongly",
        "Delete and",
        "Rewrite on",
        "Add missing",
        "unknown-code",
        "Recommendations",
        "Remove or move 4 off-topic pages",
        "Potential: +6.5 points",
        "Sub-site scores",
        "/phones",
        "Topic gaps",
        "Thin subtopic \"foot care\": only 5% of pages cover it (2 pages).",
        "Competitor terms missing on your site: cgm, libre.",
        "3 topic areas",
        "3 pages were skipped",
        "TF-IDF statistical algorithm",
        "limited data",
    ] {
        assert!(
            text.contains(part) || text.contains(&part.replace("3 topic", "1 topic")),
            "missing: {part}"
        );
    }
}

#[test]
fn focus_section_is_omitted_without_a_summary_or_when_the_template_excludes_it() {
    assert!(!text_of(&synthetic(12)).contains("Site Focus Score"));
    let mut run = with_focus(focus());
    run["report_template_sections"] = json!(["summary", "issues"]);
    assert!(!present(&run));
    assert!(!text_of(&run).contains("Site Focus Score"));
    run["report_template_sections"] = json!(["summary", "focus"]);
    assert!(present(&run));
    assert!(text_of(&run).contains("Site Focus Score"));
    assert!(!present(&with_focus(json!("nope"))));
}

#[test]
fn report_coverage_lists_the_focus_section() {
    let with = text_of(&with_focus(focus()));
    let (_, coverage) = with.split_once("Report coverage").expect("coverage table");
    assert!(coverage.contains("Weakest pages by topic relevance"));
    let bare = text_of(&synthetic(12));
    assert!(!bare
        .split_once("Report coverage")
        .unwrap()
        .1
        .contains("Weakest pages"));
}
