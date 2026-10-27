use super::focus_text::coded;
use super::sec_infogain::{band_color, notes, present};
use super::strings::infogain::{self as g, ALL, BANDS, NOTES, RECS};
use super::tests::text_of;
use super::tests_focus::with_focus;
use crate::commands::pdf_report::labels::default_keys;
use serde_json::{json, Value};

fn summary() -> Value {
    json!({
        "score": 41, "band": "average", "evaluated": 12, "baseline_docs": 4, "source": "bing-rss",
        "parts": {"nefr": 30, "edsi": 55, "fhem": null, "sdd": 40},
        "zones": {"echo": 50, "gain": 40, "drift": 10},
        "flags": {"thin_baseline": true, "fhem_unavailable_pages": 2, "truncated": 5},
        "pages": [
            {"url": "https://own.example.test/copy", "score": 12, "band": "derivative", "echo": 80, "gain": 20, "drift": 0},
            {"url": "https://own.example.test/new", "score": 70, "band": "good", "echo": 10, "gain": 80, "drift": 10}],
        "recommendations": [
            {"code": "rewrite-echo-sections", "params": {"pages": 7}},
            {"code": "mystery", "params": {}}]
    })
}

fn run_with(info: Value) -> Value {
    let mut run = with_focus(json!({"score": 1}));
    run.as_object_mut().unwrap().remove("focus");
    run["info_gain"] = info;
    run
}

#[test]
fn info_gain_section_shows_score_components_pages_and_recommendations() {
    let text = text_of(&run_with(summary()));
    for part in [
        "Information Gain", "Average originality", "41", "Weakest pages", "own.example.test/copy",
        "Derivative", "Recommendations", "12 pages", "4 competitor pages",
        "Small baseline", "No first-hand wording rules", "mystery",
    ] {
        assert!(text.contains(part), "missing: {part}");
    }
    assert!(text.contains("Report coverage"));
    assert!(text.split_once("Report coverage").unwrap().1.contains("Weakest pages"));
}

#[test]
fn section_is_omitted_without_a_summary_or_when_the_template_excludes_it() {
    assert!(!present(&with_focus(json!({"score": 1}))));
    let mut run = run_with(summary());
    assert!(present(&run));
    run["report_template_sections"] = json!(["summary", "issues"]);
    assert!(!present(&run));
    assert!(!text_of(&run).contains("Information Gain"));
    run["report_template_sections"] = json!(["summary", "infoGain"]);
    assert!(present(&run));
    assert!(!present(&run_with(json!("nope"))));
}

#[test]
fn sparse_summaries_render_and_notes_follow_the_flags() {
    let text = text_of(&run_with(json!({"score": 5, "band": "weird"})));
    assert!(text.contains("Information Gain") && text.contains("weird"));
    assert!(!text.contains("Recommendations"));
    assert!(notes(&json!({})).is_empty());
    assert_eq!(notes(&summary()).len(), 3);
}

#[test]
fn band_colors_differ_per_band() {
    let colors: Vec<_> = BANDS.iter().map(|band| band_color(band)).collect();
    assert!(colors.iter().enumerate().all(|(i, c)| colors.iter().skip(i + 1).all(|o| o != c)));
    assert_ne!(band_color("unknown"), colors[0]);
    assert_eq!(coded(g::BAND, "nope", &[]), "nope");
}

#[test]
fn every_info_gain_label_key_exists_in_english() {
    let known = default_keys();
    let mut keys: Vec<String> = ALL.iter().map(|key| (*key).to_owned()).collect();
    keys.extend(BANDS.iter().map(|code| format!("{}.{code}", g::BAND)));
    keys.extend(NOTES.iter().map(|code| format!("{}.{code}", g::NOTE)));
    keys.extend(RECS.iter().map(|(code, _)| format!("{}.{code}", g::REC)));
    let missing: Vec<_> = keys.iter().filter(|key| !known.contains(&key.as_str())).collect();
    assert!(missing.is_empty(), "missing in en.json: {missing:?}");
}
