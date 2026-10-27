use super::font::FontSet;
use super::layout::doc::{Chrome, Doc};
use super::layout::text::Style;
use super::tests::pdf_has_text;

fn pdf_of(lines: &[&str]) -> Vec<u8> {
    let chrome = Chrome {
        title: "t".into(),
        subtitle: "s".into(),
        date: "d".into(),
        note: "n".into(),
        brand: "b".into(),
        page_label: "{{page}}/{{total}}".into(),
    };
    let mut doc = Doc::new(chrome);
    for line in lines {
        doc.paragraph(40.0, 500.0, Style::BODY, line);
    }
    doc.finish()
}

#[test]
fn pdf_embeds_unicode_fonts_and_extracts_all_supported_script_text() {
    let lines = [
        "Polski: Zażółć gęślą jaźń",
        "Русский: Привет, мир",
        "中文: 你好世界 日本語: こんにちは 한국어: 안녕하세요",
        "العربية: مرحبا بالعالم",
    ];
    let bytes = pdf_of(&lines);
    let report = String::from_utf8_lossy(&bytes);
    assert!(report.matches("/Subtype /Type0").count() >= 3);
    assert!(report.contains("/ToUnicode"));
    assert!(report.contains("/FontFile2"));
    assert!(report.contains("/FontFile3"));
    assert!(pdf_has_text(&bytes, "Polski: Zażółć gęślą jaźń"));
    assert!(pdf_has_text(&bytes, "Русский: Привет, мир"));
    assert!(pdf_has_text(
        &bytes,
        "中文: 你好世界 日本語: こんにちは 한국어: 안녕하세요"
    ));
    assert!(pdf_has_text(&bytes, "العربية: مرحبا بالعالم"));
}

#[test]
fn unicode_wrapping_uses_glyph_widths_and_breaks_long_urls() {
    let fonts = FontSet::new();
    assert!(fonts.measure("WW", 10.0) > fonts.measure("ii", 10.0));
    assert!(fonts.measure("你好", 10.0) > fonts.measure("ii", 10.0));
    let url = format!("https://example.test/{}", "界".repeat(180));
    let lines = fonts.wrapped_lines(&url, 512.0, 10.0);
    assert!(lines.len() > 3);
    assert!(lines.iter().all(|line| fonts.measure(line, 10.0) <= 512.0));
    let bytes = pdf_of(&[url.as_str()]);
    assert!(bytes.starts_with(b"%PDF-1.4"));
    assert!(String::from_utf8_lossy(&bytes).contains("startxref\n"));
}
