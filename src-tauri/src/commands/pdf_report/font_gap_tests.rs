use super::*;

#[test]
fn default_font_set_matches_new_and_resolves_latin_glyphs() {
    let fonts = FontSet::default();
    assert!(fonts.glyph('A').is_some());
    assert!(fonts.glyph('\u{10FFFF}').is_none());
    assert!(fonts.glyph('\u{E000}').is_none());
}
