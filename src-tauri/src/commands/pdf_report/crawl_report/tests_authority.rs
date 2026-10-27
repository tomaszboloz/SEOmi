use super::fixture::synthetic;
use super::sec_authority::present;
use super::strings::authority::{
    self as a, ALL, LEVEL, LEVELS, QUADRANT, QUADRANTS, REC, RECS, WARNING, WARNINGS,
};
use super::tests::text_of;
use crate::commands::pdf_report::labels::default_keys;
use serde_json::{json, Value};

fn authority() -> Value {
    json!({
        "tas": 62, "sfs": 80, "quadrant": "diluted_giant", "multiplier": 0.94,
        "pillars": {"tcr": 58.5, "cdes": 40, "silc": null, "cvff": 77},
        "warnings": ["empty-authority", "template-duplicates", "no-dates", "no-links"],
        "reference": {"subtopics": 12, "pillars": 3, "competitors": 4, "source": "bing-rss"},
        "pillar_coverage": [{"label": "Pour over", "coverage_pct": 50, "gaps": 2, "shallow": 1}],
        "gaps": [{"label": "Grind size", "level": "critical", "weight": 90}],
        "cannibalization": [{"canonical": "https://x.test/a", "pages": 2, "similarity": 91}],
        "recommendations": [
            {"code": "fill-gaps", "params": {"pillar": "Pour over", "count": 2}, "gain": 4.5},
            {"code": "unknown-code", "params": {}, "gain": 0}],
        "benchmark": [{"domain": "rival.test", "sfs": 88, "tas": 71}]
    })
}

fn with_authority(value: Value) -> Value {
    let mut run = synthetic(12);
    run["authority"] = value;
    run
}

#[test]
fn section_renders_score_components_notes_and_tables() {
    let text = text_of(&with_authority(authority()));
    for needle in [
        "Topical Authority Score",
        "Diluted giant",
        "58.5",
        "n/a",
        "Reference map: 12 sub-topics in 3 pillars from 4 competitors (bing-rss).",
        "Empty authority",
        "Pillar coverage",
        "Grind size",
        "Semantic cannibalization",
        "Fill the gaps in \u{201c}Pour over\u{201d}: 2 missing sub-topics",
        "unknown-code",
        "rival.test",
    ] {
        assert!(text.contains(needle), "missing {needle:?}");
    }
}

#[test]
fn sparse_summary_says_the_reference_map_is_missing() {
    let text = text_of(&with_authority(json!({"tas": null, "pillars": {}})));
    assert!(text.contains("No reference map was built"));
    assert!(!text.contains("Pillar coverage") && !text.contains("Topical gap matrix"));
}

#[test]
fn section_follows_the_template_allow_list() {
    let mut run = with_authority(authority());
    assert!(present(&run));
    run["report_template_sections"] = json!(["summary"]);
    assert!(!present(&run));
    run["report_template_sections"] = json!(["authority"]);
    assert!(present(&run));
    assert!(!present(&synthetic(3)));
}

#[test]
fn every_authority_label_key_exists_in_english() {
    let known = default_keys();
    let mut keys: Vec<String> = ALL.iter().map(|key| (*key).to_owned()).collect();
    let coded = [
        (QUADRANT, QUADRANTS.to_vec()),
        (WARNING, WARNINGS.to_vec()),
        (LEVEL, LEVELS.to_vec()),
        (REC, RECS.iter().map(|(code, _)| *code).collect()),
    ];
    for (prefix, codes) in coded {
        keys.extend(codes.iter().map(|code| format!("{prefix}.{code}")));
    }
    let missing: Vec<_> = keys
        .iter()
        .filter(|key| !known.contains(&key.as_str()))
        .collect();
    assert!(missing.is_empty(), "missing in en.json: {missing:?}");
    assert_eq!(a::T_BENCH, "crawl.authority.tBench");
}
