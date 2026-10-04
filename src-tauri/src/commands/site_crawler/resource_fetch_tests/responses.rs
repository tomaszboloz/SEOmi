use super::*;

#[tokio::test]
async fn successful_image_preserves_headers_and_observed_dimensions() {
    let result = fetch(
        200,
        b"Content-Type: image/png\r\nContent-Length: 24\r\n",
        png(),
        "image",
    )
    .await;
    assert_eq!(result.http_status, Some(200));
    assert_eq!(result.content_type.as_deref(), Some("image/png"));
    assert_eq!(result.content_length, Some(24));
    assert_eq!(result.intrinsic_width, Some(640));
    assert_eq!(result.intrinsic_height, Some(480));
    assert_eq!(result.dimensions_source.as_deref(), Some("intrinsic-http"));
    assert_eq!(result.request_error_kind, None);
}

#[tokio::test]
async fn failed_http_and_non_images_do_not_claim_image_measurements() {
    for (status, kind) in [
        (404, "image"),
        (503, "image"),
        (200, "stylesheet"),
        (200, "script"),
        (200, "other"),
    ] {
        let result = fetch(
            status,
            b"Content-Type: image/png\r\nContent-Length: 24\r\n",
            png(),
            kind,
        )
        .await;
        assert_eq!(result.http_status, Some(status));
        assert_eq!(result.content_type.as_deref(), Some("image/png"));
        assert_eq!(result.content_length, Some(24));
        assert_eq!(result.request_error_kind, None);
        assert_unknown_dimensions(&result);
    }
}

#[tokio::test]
async fn missing_or_non_text_media_type_preserves_only_observed_values() {
    for headers in [
        b"Content-Length: 24\r\n".as_slice(),
        b"Content-Type: \x80\r\nContent-Length: 24\r\n".as_slice(),
    ] {
        let result = fetch(200, headers, png(), "image").await;
        assert_eq!(result.http_status, Some(200));
        assert_eq!(result.content_type, None);
        assert_eq!(result.intrinsic_width, Some(640));
        assert_eq!(result.intrinsic_height, Some(480));
        assert_eq!(result.request_error_kind, None);
    }
}

#[tokio::test]
async fn empty_and_unsupported_images_leave_dimensions_unknown() {
    for bytes in [Vec::new(), b"not an image".to_vec()] {
        let headers = format!(
            "Content-Type: image/png\r\nContent-Length: {}\r\n",
            bytes.len()
        );
        let result = fetch(200, headers.as_bytes(), bytes, "image").await;
        assert_eq!(result.http_status, Some(200));
        assert_eq!(result.request_error_kind, None);
        assert_unknown_dimensions(&result);
    }
}
