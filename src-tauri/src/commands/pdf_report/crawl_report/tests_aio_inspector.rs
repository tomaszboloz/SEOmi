use super::aio_inspector::inspector_table;
use super::fixture::synthetic;
use super::tests::text_of;
use serde_json::{json, Value};

fn passage(extra: Value) -> Value {
    let mut base = json!({"url": "https://shop.example.test/guide", "heading": "How long?",
        "score": 22, "excerpt": "This depends.", "issues": ["no-facts"]});
    for (key, value) in extra.as_object().expect("object").iter() {
        base[key] = value.clone();
    }
    base
}

fn summary(passages: Vec<Value>) -> Value {
    json!({"score": 50, "band": "weak", "self_containment": 50, "spo_density": 50,
        "extractability": 50, "scored": 1, "skipped": 0, "basic_rule_languages": [],
        "pages": [], "passages": passages})
}

fn render(passages: Vec<Value>) -> String {
    let mut run = synthetic(12);
    run["aio"] = summary(passages);
    text_of(&run)
}

#[test]
fn inspector_shows_components_position_and_facts_with_negation() {
    let text = render(vec![passage(json!({
        "self_containment": 46, "spo_density": 25, "answer_first": 20,
        "answer_first_applicable": true, "offset_start": 4, "offset_end": 30,
        "facts": [
            {"subject": "Sensor", "predicate": "lasts", "object": "14 days", "negated": false},
            {"subject": "Sensor", "predicate": "is", "object": "waterproof", "negated": true}
        ]
    }))]);
    for part in [
        "Passage inspector",
        "lexical heuristic",
        "chars 4",
        "46%",
        "25%",
        "20%",
        "Sensor · lasts · 14 days",
        "waterproof (negated)",
    ] {
        assert!(text.contains(part), "missing: {part}");
    }
}

#[test]
fn inspector_marks_not_applicable_unknown_and_empty_facts() {
    let text = render(vec![passage(json!({
        "self_containment": null, "spo_density": 10, "answer_first": null,
        "answer_first_applicable": false, "offset_start": null, "offset_end": null,
        "facts": []
    }))]);
    assert!(text.contains("Passage inspector"));
    assert!(text.contains("n/a"));
    assert!(text.contains("No facts detected"));
    assert!(!text.contains("chars "));
}

#[test]
fn inspector_is_omitted_for_older_summaries_without_evidence() {
    assert!(inspector_table(&summary(vec![passage(json!({}))])).is_none());
    assert!(inspector_table(&summary(vec![])).is_none());
    assert!(inspector_table(&json!({})).is_none());
    let text = render(vec![passage(json!({"facts": null}))]);
    assert!(text.contains("Weakest passages"));
    assert!(!text.contains("Passage inspector"));
}

#[test]
fn inspector_keeps_only_passages_that_carry_evidence() {
    let table = inspector_table(&summary(vec![
        passage(json!({})),
        passage(json!({"spo_density": 5, "answer_first": 70})),
    ]))
    .expect("table");
    assert_eq!(table.rows.len(), 1);
}
