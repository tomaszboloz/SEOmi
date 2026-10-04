use super::*;

#[tokio::test]
async fn exact_body_cap_is_accepted_with_or_without_announced_length() {
    for announced in [false, true] {
        let mut body = png();
        body.resize(MAX_INTRINSIC_IMAGE_BYTES, 0);
        let headers = if announced {
            format!("Content-Length: {}\r\n", body.len())
        } else {
            String::new()
        };
        let result = fetch(200, headers.as_bytes(), body, "image").await;
        assert_eq!(
            result.content_length,
            announced.then_some(MAX_INTRINSIC_IMAGE_BYTES as u64)
        );
        assert_eq!(result.intrinsic_width, Some(640));
        assert_eq!(result.intrinsic_height, Some(480));
        assert_eq!(result.request_error_kind, None);
    }
}

#[tokio::test]
async fn oversized_announced_body_is_not_read_or_used_for_dimensions() {
    let headers = format!(
        "Content-Length: {}\r\nContent-Type: image/png\r\n",
        MAX_INTRINSIC_IMAGE_BYTES + 1
    );
    // Deliberately no body: reading it would fail instead of completing a header-only check.
    let result = fetch(200, headers.as_bytes(), Vec::new(), "image").await;
    assert_eq!(result.http_status, Some(200));
    assert_eq!(
        result.content_length,
        Some((MAX_INTRINSIC_IMAGE_BYTES + 1) as u64)
    );
    assert_eq!(result.request_error_kind, None);
    assert_unknown_dimensions(&result);
}

#[tokio::test]
async fn oversized_unknown_length_discards_even_a_valid_image_prefix() {
    let mut body = png();
    body.resize(MAX_INTRINSIC_IMAGE_BYTES + 1, 0);
    let result = fetch(200, b"Content-Type: image/png\r\n", body, "image").await;
    assert_eq!(result.http_status, Some(200));
    assert_eq!(result.content_length, None);
    assert_eq!(result.request_error_kind, None);
    assert_unknown_dimensions(&result);
}

#[tokio::test]
async fn chunked_response_preserves_unknown_length_and_binary_dimensions() {
    let mut encoded = b"18\r\n".to_vec();
    encoded.extend(png());
    encoded.extend_from_slice(b"\r\n0\r\n\r\n");
    let result = fetch(
        200,
        b"Content-Type: image/png\r\nTransfer-Encoding: chunked\r\n",
        encoded,
        "image",
    )
    .await;
    assert_eq!(result.content_length, None);
    assert_eq!(result.intrinsic_width, Some(640));
    assert_eq!(result.intrinsic_height, Some(480));
    assert_eq!(result.request_error_kind, None);
}
