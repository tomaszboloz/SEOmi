use super::fixture::synthetic;
use super::sec_offpage::present;
use super::tests::text_of;
use serde_json::{json, Value};

pub(super) fn record() -> Value {
    json!({
        "scale": 100, "embedding_provider": "ollama", "embedding_model_id": "nomic-embed-text",
        "topic_label": "Search optimization", "sources_requested": 3,
        "sources_fetched": 2, "sources_scored": 1,
        "tbva": {"value": 0.875, "status": "partial",
            "limitations": ["source-text-or-authority-missing"]},
        "sources": [
            {"url": "https://source.test/page", "authority": 87.5,
                "similarity": 1, "contribution": 0.875},
            {"url": "https://missing.test/", "authority": null,
                "similarity": null, "contribution": null}
        ],
        "co_citations": [{"url": "https://source.test/page", "offset": 123,
            "excerpt": "A source mentions Search optimization."}]
    })
}

pub(super) fn with_record(data: Value) -> Value {
    let mut run = synthetic(0);
    run["offPage"] = data;
    run
}

#[test]
fn offpage_section_renders_saved_evidence_and_fixed_disclaimer() {
    let text = text_of(&with_record(record()));
    for part in [
        "Off-page analysis",
        "Search optimization",
        "Authority scale",
        "100",
        "ollama / nomic-embed-text",
        "Sources requested",
        "Sources fetched",
        "Sources scored",
        "TBVA",
        "0.875",
        "Partial",
        "Some sources lack text",
        "https://source.test/page",
        "Authority",
        "Similarity",
        "Contribution",
        "87.5",
        "n/a",
        "Co-citation excerpts",
        "Text offset",
        "123",
        "A source mentions Search optimization.",
        "Not Google PageRank",
        "not zero backlinks",
        "co-occurrence is not endorsement",
    ] {
        assert!(text.contains(part), "missing: {part}");
    }
}

#[test]
fn offpage_section_is_absent_without_a_record_or_when_template_excludes_it() {
    assert!(!text_of(&synthetic(0)).contains("Off-page analysis"));
    for absent in [Value::Null, json!("invalid"), json!([])] {
        let run = with_record(absent);
        assert!(!present(&run));
        assert!(!text_of(&run).contains("Off-page analysis"));
    }
    let mut run = with_record(record());
    run["report_template_sections"] = json!(["summary", "aio"]);
    assert!(!present(&run));
    assert!(!text_of(&run).contains("Off-page analysis"));
    run["report_template_sections"] = json!(["summary", "offPage"]);
    assert!(present(&run));
    assert!(text_of(&run).contains("Off-page analysis"));
}

#[test]
fn offpage_null_fields_are_na_not_zero_and_measured_zeros_remain_zero() {
    let mut data = record();
    data["embedding_model_id"] = Value::Null;
    data["tbva"] =
        json!({"value": null, "status": "unavailable", "limitations": ["no-topic-vector"]});
    let text = text_of(&with_record(data.clone()));
    assert!(text.contains("ollama / n/a"));
    assert!(text.contains("Unavailable"));
    assert!(text.contains("No usable Core Topic vector"));
    assert_eq!(super::offpage_tables::value(&data["tbva"], "value"), "n/a");
    data["tbva"] = json!({"value": 0, "status": "ready", "limitations": []});
    data["sources"][0] =
        json!({"url": "https://zero.test", "authority": 0, "similarity": 0, "contribution": 0});
    let view = super::data::OffPage::new(&data);
    assert_eq!(super::offpage_tables::sources(&view).rows[0][1].text, "0");
    assert_eq!(super::offpage_tables::value(view.tbva, "value"), "0");
    assert!(text_of(&with_record(data)).contains("Ready"));
}

#[test]
fn offpage_skips_empty_citations_and_limitation_blocks() {
    let mut data = record();
    data["co_citations"] = json!([]);
    data["tbva"]["limitations"] = json!([]);
    let text = text_of(&with_record(data));
    assert!(text.contains("Saved per-source evidence"));
    assert!(!text.contains("Co-citation excerpts"));
    assert!(!text.contains("Limitations:"));
}
