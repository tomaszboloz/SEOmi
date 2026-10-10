use super::*;

#[test]
fn inline_image_dimensions_reject_short_invalid_and_zero_raster_headers() {
    assert!(inline_image_dimensions("data:image/png;base64,AAAA").is_none());
    assert!(inline_image_dimensions("data:image/gif;base64,AAAA").is_none());

    let mut png = vec![137, 80, 78, 71, 13, 10, 26, 10];
    png.resize(24, 0);
    let png_uri = |width: u32, height: u32| {
        let mut bytes = png.clone();
        bytes[16..20].copy_from_slice(&width.to_be_bytes());
        bytes[20..24].copy_from_slice(&height.to_be_bytes());
        format!("data:image/png;base64,{}", BASE64_STANDARD.encode(bytes))
    };
    assert!(inline_image_dimensions(&png_uri(0, 2)).is_none());
    assert!(inline_image_dimensions(&png_uri(2, 0)).is_none());
    assert!(inline_image_dimensions("data:image/png;base64,not-base64").is_none());

    let gif_zero = b"GIF89a\x00\x00\x05\x00";
    assert!(inline_image_dimensions(&format!(
        "data:image/gif;base64,{}",
        BASE64_STANDARD.encode(gif_zero)
    ))
    .is_none());
    assert!(inline_image_dimensions("data:image/gif;base64,not-base64").is_none());
}

#[test]
fn inline_image_dimensions_enforce_supported_mime_and_base64_contracts() {
    for source in [
        "data:image/jpeg;base64,AAAA",
        "data:image/png,AAAA",
        "data:text/plain;base64,AAAA",
        "data:image/png;base64,",
        "data:image/svg+xml;base64,////",
        "data:image/svg+xml,<svg width=\"bad\" height=\"bad\">",
    ] {
        assert!(inline_image_dimensions(source).is_none(), "{source}");
    }
    assert!(inline_image_dimensions("https://example.test/a.png").is_none());
}

#[test]
fn inline_image_format_reads_only_nonempty_image_mime_tokens() {
    assert_eq!(
        inline_image_format("data:image/png;base64,AAAA").as_deref(),
        Some("png")
    );
    assert_eq!(
        inline_image_format("DATA:IMAGE/SVG+XML,markup").as_deref(),
        Some("svg+xml")
    );
    assert!(inline_image_format("data:image/,payload").is_none());
    assert!(inline_image_format("data:text/plain,payload").is_none());
    assert!(inline_image_format("https://example.test/image.png").is_none());
    assert!(inline_image_format("data:image/png").is_none());
}
