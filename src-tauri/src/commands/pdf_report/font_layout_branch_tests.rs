use crate::commands::pdf_report::font::FontSet;
use crate::commands::pdf_report::text_utils::{
    ascii_pdf_text, pdf_literal, wrapped_lines as wrapped_text_lines,
};

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

#[test]
fn test_text_utils_branches() {
    let polish = "ĄĆĘŁŃÓŚŹŻ";
    let ascii_polish = ascii_pdf_text(polish);
    assert!(!ascii_polish.is_empty());

    let specials = "ßẞæÆœŒþÞđðħıĸłŧøĐÐĦŦØ\u{0300}©";
    let ascii_specials = ascii_pdf_text(specials);
    assert!(ascii_specials.contains("ss"));
    assert!(ascii_specials.contains("SS"));
    assert!(ascii_specials.contains("ae"));
    assert!(ascii_specials.contains("AE"));
    assert!(ascii_specials.contains("oe"));
    assert!(ascii_specials.contains("OE"));
    assert!(ascii_specials.contains("th"));
    assert!(ascii_specials.contains("TH"));
    assert!(ascii_specials.contains('d'));
    assert!(ascii_specials.contains('h'));
    assert!(ascii_specials.contains('i'));
    assert!(ascii_specials.contains('k'));
    assert!(ascii_specials.contains('l'));
    assert!(ascii_specials.contains('t'));
    assert!(ascii_specials.contains('o'));
    assert!(ascii_specials.contains('D'));
    assert!(ascii_specials.contains('H'));
    assert!(ascii_specials.contains('T'));
    assert!(ascii_specials.contains('O'));
    assert!(ascii_specials.contains('?'));

    let literal = pdf_literal("test (brackets) \\ slash");
    assert!(literal.contains("\\(brackets\\)"));
    assert!(literal.contains("\\\\"));

    let wrapped = wrapped_text_lines("short", 10);
    assert_eq!(wrapped, vec!["short".to_string()]);

    let long_wrapped = wrapped_text_lines("a/b?c&d-e_f=g/h?i&j-k_l=m", 5);
    assert!(!long_wrapped.is_empty());

    let empty_wrapped = wrapped_text_lines("", 5);
    assert_eq!(empty_wrapped, vec!["-".to_string()]);

    let multi_word = wrapped_text_lines("hello world test", 6);
    assert!(!multi_word.is_empty());

    let overflow_word = wrapped_text_lines("abcdefghijklmnopqrstuvwxyz", 5);
    assert!(!overflow_word.is_empty());
}
