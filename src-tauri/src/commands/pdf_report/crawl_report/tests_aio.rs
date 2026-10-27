use super::fixture::synthetic;
use super::sec_aio::present;
use super::strings::aio::{self as a, ALL, BANDS, ISSUES};
use super::tests::text_of;
use crate::commands::pdf_report::labels::default_keys;
use serde_json::{json, Value};

fn aio() -> Value {
    json!({
        "score": 58.5, "band": "weak", "self_containment": 61, "spo_density": 40.5,
        "extractability": 70, "scored": 12, "skipped": 2,
        "profile": {
            "id": "aio-r-v1-en",
            "algorithm_version": "1.0.0",
            "config_hash": "cfg-1234",
            "language": "en",
            "market": "global"
        },
        "profile_status": "persisted",
        "unknown_reasons": [],
        "basic_rule_languages": ["de", "ja"],
        "pages": [
            {"url": "https://shop.example.test/guide", "score": 31, "self_containment": 40,
             "spo_density": 10, "extractability": 25, "chunks": 6, "triples": 2, "language": "en"},
            {"url": "https://shop.example.test/faq", "score": 80, "self_containment": 90,
             "spo_density": 70, "extractability": 75, "chunks": 3, "triples": 9, "language": "en"}
        ],
        "passages": [
            {"url": "https://shop.example.test/guide", "heading": "How long does it last?",
             "score": 22, "excerpt": "This depends on many factors.",
             "issues": ["dangling-pronoun", "no-answer-first", "mystery-code"]}
        ]
    })
}

fn with_aio(aio: Value) -> Value {
    let mut run = synthetic(12);
    run["aio"] = aio;
    run
}

#[test]
fn aio_section_shows_score_kpis_pages_and_passages() {
    let text = text_of(&with_aio(aio()));
    for part in [
        "AI Overviews & RAG readiness",
        "AI readiness score",
        "Weak readiness",
        "58",
        "Self-containment",
        "Fact density",
        "Extractability",
        "2 pages skipped",
        "Evaluation profile",
        "aio-r-v1-en",
        "Profile persisted",
        "1.0.0",
        "cfg-1234",
        "global",
        "Language rules for de, ja are basic",
        "Pages by AI readiness",
        "shop.example.test/guide",
        "Weakest passages",
        "How long does it last?",
        "This depends on many factors.",
        "Unclear reference",
        "mystery",
    ] {
        assert!(text.contains(part), "missing: {part}");
    }
}

#[test]
fn aio_profile_status_discloses_legacy_and_mismatch_runs() {
    let mut legacy = aio();
    legacy.as_object_mut().unwrap().remove("profile");
    legacy.as_object_mut().unwrap().remove("profile_status");
    let legacy_text = text_of(&with_aio(legacy));
    assert!(legacy_text.contains("Legacy / unversioned profile"));
    assert!(!legacy_text.contains("aio-r-v1-en"));

    let mut mismatch = aio();
    mismatch["profile_status"] = json!("mismatch");
    let mismatch_text = text_of(&with_aio(mismatch));
    assert!(mismatch_text.contains("Profile mismatch"));
}

#[test]
fn aio_unknown_reasons_are_disclosed_and_old_payloads_stay_valid() {
    let mut data = aio();
    data["unknown_reasons"] = json!(["unsupported-language", "missing-evidence"]);
    let text = text_of(&with_aio(data));
    assert!(text.contains("Unknown or unavailable reasons"));
    assert!(text.contains("unsupported-language, missing-evidence"));

    let mut old = aio();
    old.as_object_mut().unwrap().remove("profile");
    old.as_object_mut().unwrap().remove("profile_status");
    old.as_object_mut().unwrap().remove("unknown_reasons");
    let old_text = text_of(&with_aio(old));
    assert!(old_text.contains("AI readiness score"));
    assert!(old_text.contains("Legacy / unversioned profile"));
    assert!(!old_text.contains("Profile persisted"));
}

#[test]
fn aio_section_is_omitted_without_a_summary_or_when_the_template_excludes_it() {
    assert!(!text_of(&synthetic(12)).contains("AI readiness score"));
    let mut run = with_aio(aio());
    run["report_template_sections"] = json!(["summary", "issues"]);
    assert!(!present(&run));
    assert!(!text_of(&run).contains("AI readiness score"));
    run["report_template_sections"] = json!(["summary", "aio"]);
    assert!(present(&run));
    assert!(text_of(&run).contains("AI readiness score"));
    assert!(!present(&with_aio(json!("nope"))));
}

#[test]
fn aio_section_without_passages_or_notes_skips_those_blocks() {
    let mut data = aio();
    data["passages"] = json!([]);
    data["basic_rule_languages"] = json!([]);
    let text = text_of(&with_aio(data));
    assert!(text.contains("Pages by AI readiness"));
    assert!(!text.contains("Weakest passages"));
    assert!(!text.contains("are basic"));
}

#[test]
fn every_aio_label_key_exists_in_english() {
    let known = default_keys();
    let mut keys: Vec<String> = ALL.iter().map(|key| (*key).to_owned()).collect();
    keys.extend(BANDS.iter().map(|code| format!("{}.{code}", a::BAND)));
    keys.extend(ISSUES.iter().map(|code| format!("{}.{code}", a::ISSUE)));
    let missing: Vec<_> = keys
        .iter()
        .filter(|key| !known.contains(&key.as_str()))
        .collect();
    assert!(missing.is_empty(), "missing in en.json: {missing:?}");
}
