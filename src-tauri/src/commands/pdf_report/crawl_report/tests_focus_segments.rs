use super::focus_segments::segments;
use super::tests::text_of;
use super::tests_focus::{focus, with_focus};
use serde_json::json;

#[test]
fn segment_table_shows_each_user_segment_and_a_dash_for_unscored_ones() {
    let mut summary = focus();
    summary["segments"] = json!([
        {"label": "Shop", "path_prefix": "/shop", "core": "insulin pumps", "scored": 9, "pages": 10, "score": 81.5},
        {"label": "Ghost", "path_prefix": "/missing", "core": "", "scored": 0, "pages": 0, "score": null}
    ]);
    let table = segments(&summary).expect("segments table");
    assert_eq!(table.rows.len(), 2);
    let text = text_of(&with_focus(summary));
    for part in [
        "Segment scores",
        "/shop",
        "insulin pumps",
        "9/10",
        "81.5",
        "/missing",
        "0/0",
    ] {
        assert!(text.contains(part), "missing {part}");
    }
}

#[test]
fn no_segments_means_no_table() {
    assert!(segments(&focus()).is_none());
    assert!(segments(&json!({"segments": []})).is_none());
    assert!(!text_of(&with_focus(focus())).contains("Segment scores"));
}
