use super::crawl_tables::{append_images_table, append_links_table};
use super::font::FontSet;
use serde_json::json;

#[test]
fn tables_render_external_links_and_lazy_images() {
    let pages = vec![json!({
        "url": "https://e.test/",
        "links": [{"target_url": "https://x.test/", "is_internal": false}],
        "images": [{"src": "/a.png", "lazy_loaded": true}]
    })];
    let mut lines = Vec::new();
    append_links_table(&mut lines, &pages);
    append_images_table(&mut lines, &pages);
    assert!(lines.iter().any(|l| l.ends_with("| no")));
    assert!(lines.iter().any(|l| l.ends_with("| yes")));
}

#[test]
fn glyphs_wider_than_the_line_are_split_without_empty_lines() {
    let fonts = FontSet::new();
    let lines = fonts.wrapped_lines("WW W", 0.5, 10.0);
    assert_eq!(lines, ["W", "W", "W"]);
}

#[test]
fn empty_or_non_string_limit_reasons_do_not_add_a_limits_line() {
    use super::crawl_text::crawl_text_lines;
    for reasons in [json!([]), json!([1, null])] {
        let run = json!({"id": "r", "result": {"limit_reasons": reasons}});
        assert!(!crawl_text_lines(&run)
            .iter()
            .any(|line| line.starts_with("Limits observed")));
    }
}

#[test]
fn glyphs_without_a_font_mapping_fall_back_to_a_question_mark_actual_text() {
    let mut fonts = FontSet::new();
    let unmapped = super::renderer::encoded_text(&mut fonts, 10, "\u{0378}");
    assert!(unmapped.contains("Tj"));
    assert!(unmapped.contains("<FEFF003F>") && unmapped.contains("EMC"));
    let mapped = super::renderer::encoded_text(&mut fonts, 10, "A");
    assert!(mapped.contains("BDC") && mapped.contains("EMC"));
}
