use super::focus_text::{arg, coded, from_params};
use super::sec_focus::{band_color, notes};
use super::strings::focus::{self as f, ALL, BANDS, NOTES, OPTIONS, RECS, STATUSES, TYPES};
use super::tests::text_of;
use super::tests_focus::{focus, with_focus};
use crate::commands::pdf_report::labels::default_keys;
use serde_json::json;

const GAPS: &[&str] = &["thin-subtopic", "competitor-terms"];

#[test]
fn sparse_summaries_render_without_optional_blocks() {
    let text = text_of(&with_focus(
        json!({"score": 10, "band": "mystery", "core_topic": {"manual_input": "diabetes", "manual_matched": false}}),
    ));
    assert!(text.contains("Site Focus Score") && text.contains("mystery"));
    assert!(
        text.contains("Manual topic: diabetes")
            && text.contains("No pages matched the topic \"diabetes\"")
    );
    assert!(!text.contains("Sub-site scores") && !text.contains("Topic gaps"));
}

#[test]
fn notes_follow_the_flags() {
    assert!(notes(&json!({})).is_empty());
    let low = notes(&json!({"flags": {"low_confidence": true}, "counts": {"scored": 7}}));
    assert!(low[0].contains("Small sample (7 pages)"));
    assert_eq!(notes(&focus()).len(), 4);
}

#[test]
fn notes_state_anchored_topic_provenance_and_missing_anchors() {
    let core = json!({"mode": "anchored", "anchor_source_count": 3, "anchor_missing_count": 2});
    let anchored = notes(&json!({ "core_topic": core }));
    assert!(anchored[0].contains("anchor pages (3 pages)"));
    assert!(anchored[1].contains("not found in this crawl: 2"));
    let auto = json!({"core_topic": {"mode": "auto", "anchor_missing_count": 0}});
    assert!(notes(&auto).is_empty());
}

#[test]
fn notes_state_whether_the_business_goal_chose_the_topic() {
    let chosen = json!({"core_topic": {"mode": "goal", "business_goal": "sell pumps", "goal_matched": true}});
    assert_eq!(
        notes(&chosen),
        vec!["The core topic was chosen by the business goal \"sell pumps\"."]
    );
    let unmatched = json!({"core_topic": {"mode": "auto", "business_goal": "sell pumps", "goal_matched": false}});
    assert!(notes(&unmatched)[0].contains("matched no crawled content"));
    let ignored = json!({"core_topic": {"mode": "manual", "business_goal": "sell pumps", "goal_matched": true}});
    assert!(notes(&ignored).is_empty());
}

#[test]
fn band_colors_differ_per_band() {
    let colors: Vec<_> = BANDS.iter().map(|band| band_color(band)).collect();
    assert!(colors
        .iter()
        .enumerate()
        .all(|(i, c)| colors.iter().skip(i + 1).all(|o| o != c)));
    assert_ne!(band_color("unknown"), colors[0]);
}

#[test]
fn text_helpers_format_numbers_and_fall_back_to_codes() {
    assert_eq!(arg(Some(&json!(2.0))), "2");
    assert_eq!(arg(Some(&json!(2.26))), "2.3");
    assert_eq!(arg(Some(&json!(" x "))), "x");
    assert_eq!(arg(Some(&json!(true))), "\u{2014}");
    assert_eq!(arg(None), "\u{2014}");
    assert_eq!(coded("crawl.focus.band", "nope", &[]), "nope");
    assert_eq!(from_params("crawl.focus.rec", RECS, "add-internal-links", None), "Add internal links to hub pages: \u{2014} link suggestions send weak pages to strong hubs.");
    assert_eq!(
        from_params("crawl.focus.rec", RECS, "mystery", None),
        "mystery"
    );
}

#[test]
fn every_focus_label_key_exists_in_english() {
    let known = default_keys();
    let mut keys: Vec<String> = ALL.iter().map(|key| (*key).to_owned()).collect();
    let coded = [
        (f::BAND, BANDS.to_vec()),
        (f::NOTE, NOTES.to_vec()),
        (f::STATUS, STATUSES.to_vec()),
        (f::TYPE, TYPES.to_vec()),
        (f::GAP, GAPS.to_vec()),
        (f::REC, RECS.iter().map(|(code, _)| *code).collect()),
        (f::OPTION, OPTIONS.iter().map(|(code, _)| *code).collect()),
    ];
    for (prefix, codes) in coded {
        keys.extend(codes.iter().map(|code| format!("{prefix}.{code}")));
    }
    let missing: Vec<_> = keys
        .iter()
        .filter(|key| !known.contains(&key.as_str()))
        .collect();
    assert!(missing.is_empty(), "missing in en.json: {missing:?}");
}
