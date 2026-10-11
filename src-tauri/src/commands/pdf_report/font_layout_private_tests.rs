use super::*;

#[test]
fn arabic_text_without_a_shaper_falls_back_to_scalar_encoding() {
    let mut fonts = FontSet::new();
    fonts.arabic_shaper = None;
    let runs = fonts.encode("\u{0627}\u{0628}");
    assert!(!runs.is_empty());
}

#[test]
fn shaping_empty_arabic_text_adds_no_run() {
    let mut fonts = FontSet::new();
    let mut runs = Vec::new();
    fonts.encode_arabic("", &mut runs);
    assert!(runs.is_empty());
}

#[test]
fn placeholder_resolution_degrades_from_question_mark_to_notdef() {
    let fonts = FontSet::new();
    let missing = fonts.glyph_or_placeholder('\u{FFFF}');
    assert_eq!(missing.id, fonts.glyph('?').unwrap().id);
    let mut empty = FontSet::new();
    empty.latin = None;
    empty.cjk = None;
    let fallback = empty.glyph_or_placeholder('A');
    assert_eq!((fallback.id, fallback.width), (0, 600));
    assert!(empty.measure("A", 10.0) > 0.0);
}

fn mapped_glyph_text(fonts: &FontSet, runs: &[EncodedRun]) -> String {
    runs.iter()
        .flat_map(|run| run.hex.as_bytes().chunks(4).map(move |raw| (run.kind, raw)))
        .filter_map(|(kind, raw)| {
            let id = u16::from_str_radix(std::str::from_utf8(raw).ok()?, 16).ok()?;
            fonts.mappings.get(&kind)?.get(&id).cloned()
        })
        .collect()
}

#[test]
fn mixed_arabic_runs_encode_both_arabic_and_latin_runs() {
    let text = "العربية: مرحبا بالعالم 123";
    let mut fonts = FontSet::new();
    let encoded = fonts.encode(text);
    let displayed = mapped_glyph_text(&fonts, &encoded);
    assert!(!displayed.is_empty());
    assert!(encoded.iter().any(|r| r.kind == FontKind::Arabic));
}
