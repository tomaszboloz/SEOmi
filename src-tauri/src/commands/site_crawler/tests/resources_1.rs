use super::*;

#[test]
fn srcset_parser_preserves_candidate_commas_inside_data_urls_and_reads_descriptors() {
    let urls = parse_srcset_urls(
        "small.webp 1x, https://cdn.example.test/large.webp 2x, data:image/svg+xml,%3Csvg,%3E 3x",
    );

    assert_eq!(
        urls,
        vec![
            "small.webp",
            "https://cdn.example.test/large.webp",
            "data:image/svg+xml,%3Csvg,%3E",
        ]
    );
}

#[test]
fn srcset_parser_handles_empty_candidates_trailing_commas_and_parenthesized_commas() {
    assert_eq!(parse_srcset_urls(" \t,\n , "), Vec::<String>::new());
    assert_eq!(
        parse_srcset_urls("one.webp, two.webp 1x"),
        vec!["one.webp", "two.webp"]
    );
    assert_eq!(parse_srcset_urls("one.webp,"), vec!["one.webp"]);
    assert_eq!(
        parse_srcset_urls("one.webp 1x(foo,bar), two.webp"),
        vec!["one.webp", "two.webp"]
    );
    assert_eq!(parse_srcset_urls("terminal.webp"), vec!["terminal.webp"]);
}

#[test]
fn resource_crawl_only_enables_explicitly_selected_resource_types() {
    let mut config = crawl_config_for_test();
    config.crawl_images = true;
    config.crawl_scripts = true;

    assert!(resource_type_enabled("image", &config));
    assert!(resource_type_enabled("script", &config));
    assert!(!resource_type_enabled("stylesheet", &config));
    assert!(!resource_type_enabled("other", &config));
    assert!(is_other_resource_url(
        &url::Url::parse("https://example.com/files/report.pdf").unwrap()
    ));
    assert!(!is_other_resource_url(
        &url::Url::parse("https://example.com/article").unwrap()
    ));
}

#[test]
fn inline_image_dimensions_are_bounded_and_local_only() {
    let mut png = vec![137, 80, 78, 71, 13, 10, 26, 10];
    png.resize(24, 0);
    png[16..20].copy_from_slice(&2u32.to_be_bytes());
    png[20..24].copy_from_slice(&3u32.to_be_bytes());
    let png_uri = format!("data:image/png;base64,{}", BASE64_STANDARD.encode(png));
    assert_eq!(inline_image_dimensions(&png_uri), Some((2, 3)));
    assert_eq!(inline_image_format(&png_uri).as_deref(), Some("png"));

    let gif_uri = "data:image/gif;base64,R0lGODlhBAAFAAAA";
    assert_eq!(inline_image_dimensions(gif_uri), Some((4, 5)));
    let svg_uri = "data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20120%2060%22%3E%3C/svg%3E";
    assert_eq!(inline_image_dimensions(svg_uri), Some((120, 60)));
    let svg_attributes = "data:image/svg+xml,<svg width=\"80\" height=\"40\"></svg>";
    assert_eq!(inline_image_dimensions(svg_attributes), Some((80, 40)));
    let percentage_svg = "data:image/svg+xml,%3Csvg%20width%3D%22100%25%22%20height%3D%2250%25%22%20viewBox%3D%220%200%2080%2040%22%3E%3C/svg%3E";
    assert_eq!(inline_image_dimensions(percentage_svg), Some((80, 40)));
    assert!(inline_image_dimensions("https://example.com/image.png").is_none());
    let oversized = format!("data:image/png;base64,{}", "A".repeat(2_000_001));
    assert!(inline_image_dimensions(&oversized).is_none());
    assert!(
        bounded_inline_image_uri(&format!("data:image/png,{}", "x".repeat(9_000))).len()
            > MAX_INLINE_IMAGE_URI_CHARS
    );
}

#[test]
fn fetched_image_dimensions_decode_bounded_supported_formats_without_retaining_body() {
    let mut png = vec![137, 80, 78, 71, 13, 10, 26, 10];
    png.resize(24, 0);
    png[16..20].copy_from_slice(&7u32.to_be_bytes());
    png[20..24].copy_from_slice(&9u32.to_be_bytes());
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/png"), &png),
        Some((7, 9))
    );

    let gif = b"GIF89a\x04\x00\x05\x00\x00\x00";
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/gif"), gif),
        Some((4, 5))
    );

    let mut webp = vec![0u8; 30];
    webp[0..4].copy_from_slice(b"RIFF");
    webp[8..12].copy_from_slice(b"WEBP");
    webp[12..16].copy_from_slice(b"VP8X");
    webp[24..27].copy_from_slice(&49u32.to_le_bytes()[..3]);
    webp[27..30].copy_from_slice(&39u32.to_le_bytes()[..3]);
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/webp"), &webp),
        Some((50, 40))
    );

    let jpeg = [
        0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x32, 0x00, 0x64, 0x00, 0x00, 0x00, 0x00,
    ];
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/jpeg"), &jpeg),
        Some((100, 50))
    );

    let svg = br#"<svg viewBox="0 0 120 60"></svg>"#;
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/svg+xml"), svg),
        Some((120, 60))
    );

    let mut oversized = vec![0u8; MAX_INTRINSIC_IMAGE_BYTES + 1];
    oversized[..8].copy_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);
    assert!(intrinsic_http_image_dimensions(Some("image/png"), &oversized).is_none());
}
