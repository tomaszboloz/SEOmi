use crate::commands::pdf_report::font::FontSet;

#[test]
fn test_font_layout_and_arabic_branches() {
    let mut fonts = FontSet::new();
    let arabic_text = "\u{0627}\u{0750}\u{08A0}\u{FB50}\u{FE70} A";
    let runs = fonts.encode(arabic_text);
    assert!(!runs.is_empty());

    let missing = fonts.glyph('\u{FFFF}');
    assert!(missing.is_none());
    let missing_runs = fonts.encode("\u{FFFF}");
    assert!(!missing_runs.is_empty());
}

#[test]
fn test_font_wrap_branches() {
    let fonts = FontSet::new();
    let measured = fonts.measure("Hello", 10.0);
    assert!(measured > 0.0);

    let long_word = "abc/def?ghi&jkl-mno_pqr=stuXYZ1234567890abcdefghijklmnopqrstuvwxyz";
    let wrapped = fonts.wrapped_lines(long_word, 30.0, 10.0);
    assert!(!wrapped.is_empty());

    let empty_wrapped = fonts.wrapped_lines("", 100.0, 10.0);
    assert_eq!(empty_wrapped, vec!["-".to_string()]);
}
