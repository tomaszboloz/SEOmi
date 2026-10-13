use super::font::FontSet;

#[test]
fn glyphs_wider_than_the_line_are_split_without_empty_lines() {
    let fonts = FontSet::new();
    let lines = fonts.wrapped_lines("WW W", 0.5, 10.0);
    assert_eq!(lines, ["W", "W", "W"]);
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
