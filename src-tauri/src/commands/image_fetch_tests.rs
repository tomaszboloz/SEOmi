use super::*;

#[test]
fn encodes_bytes_as_base64_with_camel_case_fields() {
    let download = to_download(ImageBytes {
        final_url: "https://a.test/i.png".into(),
        content_type: "image/png".into(),
        bytes: b"abc".to_vec(),
    });
    let json = serde_json::to_value(download).unwrap();
    assert_eq!(json["base64"], "YWJj");
    assert_eq!(json["finalUrl"], "https://a.test/i.png");
    assert_eq!(json["contentType"], "image/png");
}

#[tokio::test]
async fn rejects_malformed_and_private_urls_before_any_connection() {
    assert_eq!(
        fetch_image_bytes("not a url".into()).await.unwrap_err(),
        "Invalid image URL"
    );
    let error = fetch_image_bytes("http://127.0.0.1/a.png".into())
        .await
        .unwrap_err();
    assert!(error.starts_with("Image download failed:"));
}
