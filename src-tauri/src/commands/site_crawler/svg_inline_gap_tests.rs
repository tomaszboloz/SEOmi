use super::*;

#[test]
fn oversized_payload_is_rejected() {
    assert_eq!(decode_inline_text_payload(&"a".repeat(1_000_001)), None);
}

#[test]
fn attribute_search_skips_name_occurrences_without_equals_sign() {
    let svg = "<svg data-width-x=\"1\" width=\"5\">";
    assert_eq!(svg_attribute(svg, "width").as_deref(), Some("5"));
    assert_eq!(svg_attribute("<svg width-only>", "width"), None);
}
