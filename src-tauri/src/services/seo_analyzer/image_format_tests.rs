use super::{infer_image_format, parse_dimension_token};

#[test]
fn contract_image_format_uses_path_suffix_and_data_mime_instead_of_query_hints() {
    for (src, expected) in [
        (
            "https://cdn.test/photo.JPEG?format=webp#image.avif",
            Some("jpeg"),
        ),
        ("/download?name=photo.webp", None),
        ("/photo.png/thumbnail", None),
        ("/image#photo.avif", None),
        (
            "data:image/svg+xml;charset=utf-8,%3Csvg%3E",
            Some("svg+xml"),
        ),
        ("data:image/png;base64,AAAA", Some("png")),
        ("data:text/plain;base64,AAAA", None),
        ("", None),
    ] {
        assert_eq!(infer_image_format(src).as_deref(), expected, "{src}");
    }
}

#[test]
fn contract_dimension_token_pixel_bounds_and_numeric_validation() {
    for (value, expected) in [
        ("1", Some(1)),
        ("100000 PX", Some(100_000)),
        ("0002px", Some(2)),
        ("+2", None),
        ("-2", None),
        ("1.5px", None),
        ("1e2", None),
        ("１２", None),
        ("184467440737095516160", None),
    ] {
        assert_eq!(parse_dimension_token(value), expected, "{value:?}");
    }
}

#[test]
fn infers_supported_formats_after_query_and_fragment_normalization() {
    for (src, expected) in [
        ("https://cdn.test/photo.WEBP?width=1", "webp"),
        ("/photo.avif#hero", "avif"),
        ("/icon.svg", "svg"),
        ("/photo.png", "png"),
        ("/photo.jpg", "jpeg"),
        ("/photo.jpeg", "jpeg"),
        ("/photo.gif", "gif"),
        ("/favicon.ico", "ico"),
    ] {
        assert_eq!(infer_image_format(src).as_deref(), Some(expected), "{src}");
    }
    assert_eq!(
        infer_image_format("DATA:IMAGE/AVIF;BASE64,AAAA"),
        Some("avif".into())
    );
    assert_eq!(infer_image_format("/photo.bmp"), None);
}

#[test]
fn dimension_tokens_accept_pixels_and_reject_unsafe_or_ambiguous_values() {
    assert_eq!(parse_dimension_token(" 320px "), Some(320));
    assert_eq!(parse_dimension_token("480"), Some(480));
    for value in ["", "50%", "12em", "0", "100001", "abc", "20pxx"] {
        assert_eq!(parse_dimension_token(value), None, "{value:?}");
    }
}
