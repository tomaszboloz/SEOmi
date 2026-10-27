use super::*;

#[test]
fn inline_text_decoder_rejects_truncated_hex_and_invalid_utf8() {
    assert_eq!(
        decode_inline_text_payload("hello%20world"),
        Some("hello world".into())
    );
    for payload in ["trailing%", "short%a", "bad%GG", "bad%0G"] {
        assert!(decode_inline_text_payload(payload).is_none(), "{payload}");
    }
    assert!(decode_inline_text_payload("%C3%28").is_none());
}

#[test]
fn svg_attribute_parser_requires_quoted_values_and_closed_quotes() {
    let svg = r#"<svg WIDTH = '80' height="40" data-width=20></svg>"#;
    assert_eq!(svg_attribute(svg, "width").as_deref(), Some("80"));
    assert_eq!(svg_attribute(svg, "HEIGHT").as_deref(), Some("40"));
    assert!(svg_attribute(svg, "data-width").is_none());
    assert!(svg_attribute(r#"<svg width="40></svg>"#, "width").is_none());
    assert!(svg_attribute("<svg width=40>", "width").is_none());
    assert!(svg_attribute("<svg>", "width").is_none());
}

#[test]
fn svg_numeric_dimensions_reject_non_positive_non_finite_and_percent_values() {
    assert_eq!(svg_numeric_dimension(" 12.6px "), Some(13));
    assert_eq!(svg_numeric_dimension("12 px"), Some(12));
    for value in ["", "100%", "0", "-1", "NaN", "inf", "not-a-number"] {
        assert!(svg_numeric_dimension(value).is_none(), "{value}");
    }
}

#[test]
fn inline_svg_dimensions_cover_base64_fallback_and_malformed_viewboxes() {
    let xml = r#"<svg width="80" height="40"></svg>"#;
    let encoded = BASE64_STANDARD.encode(xml.as_bytes());
    assert_eq!(
        svg_inline_dimensions(&format!("data:image/svg+xml;base64,{encoded}")),
        Some((80, 40))
    );
    assert_eq!(
        svg_inline_dimensions(
            "data:image/svg+xml,<svg width=\"0\" height=\"40\" viewBox=\"0 0 120 60\">"
        ),
        Some((120, 60))
    );
    for source in [
        "data:image/svg+xml;base64,%%%",
        "data:image/svg+xml,%C3%28",
        "data:image/svg+xml,<svg viewBox=\"0 0 30\">",
        "data:image/svg+xml,<svg viewBox=\"0 0 -30 40\">",
        "data:image/svg+xml,<svg viewBox=\"0 0 NaN 40\">",
        "data:image/svg+xml,no-svg",
        "no-comma",
    ] {
        assert!(svg_inline_dimensions(source).is_none(), "{source}");
    }
}
