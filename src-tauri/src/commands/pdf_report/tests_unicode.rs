use super::font::FontSet;
use super::renderer::pdf_bytes;
use super::tests::pdf_has_text;

#[test]
fn pdf_embeds_unicode_fonts_and_extracts_all_supported_script_text() {
    let lines = vec![
        "Polski: Zażółć gęślą jaźń".into(),
        "Русский: Привет, мир".into(),
        "中文: 你好世界 日本語: こんにちは 한국어: 안녕하세요".into(),
        "العربية: مرحبا بالعالم".into(),
    ];
    let bytes = pdf_bytes(lines, None);
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
    let bytes = pdf_bytes(vec![url], None);
    assert!(bytes.starts_with(b"%PDF-1.4"));
    assert!(String::from_utf8_lossy(&bytes).contains("startxref\n"));
}
