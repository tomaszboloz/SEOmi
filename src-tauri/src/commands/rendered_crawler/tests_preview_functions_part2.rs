use super::*;

#[tokio::test]
async fn test_open_rendered_element_preview_validates_inputs() {
    let app = StorageApp::new(mock_builder());
    let handle = app.handle();
    let long_sel = "x".repeat(PREVIEW_SELECTOR_MAX_CHARS + 1);
    let long_needle = "x".repeat(PREVIEW_NEEDLE_MAX_CHARS + 1);

    assert!(
        open_preview(&handle, "http://127.0.0.1:8080", "div", None, "T", "M")
            .await
            .is_err()
    );
    assert!(
        open_preview(&handle, "https://example.test/", "", None, "T", "M")
            .await
            .unwrap_err()
            .contains("empty")
    );
    assert!(
        open_preview(&handle, "https://example.test/", &long_sel, None, "T", "M")
            .await
            .unwrap_err()
            .contains("exceeds")
    );
    assert!(
        open_preview(&handle, "https://example.test/", "div\0", None, "T", "M")
            .await
            .unwrap_err()
            .contains("null")
    );

    assert!(
        open_preview(&handle, "https://example.test/", "div", Some(""), "T", "M")
            .await
            .unwrap_err()
            .contains("empty")
    );
    assert!(open_preview(
        &handle,
        "https://example.test/",
        "div",
        Some(&long_needle),
        "T",
        "M"
    )
    .await
    .unwrap_err()
    .contains("exceeds"));
    assert!(open_preview(
        &handle,
        "https://example.test/",
        "div",
        Some("a\0b"),
        "T",
        "M"
    )
    .await
    .unwrap_err()
    .contains("null"));

    assert!(
        open_preview(&handle, "https://example.test/", "div", None, "", "M")
            .await
            .unwrap_err()
            .contains("empty")
    );
    assert!(open_preview(
        &handle,
        "https://example.test/",
        "div",
        None,
        &long_sel,
        "M"
    )
    .await
    .unwrap_err()
    .contains("exceeds"));
    assert!(
        open_preview(&handle, "https://example.test/", "div", None, "T\0", "M")
            .await
            .unwrap_err()
            .contains("null")
    );

    assert!(
        open_preview(&handle, "https://example.test/", "div", None, "T", "")
            .await
            .unwrap_err()
            .contains("empty")
    );
    assert!(open_preview(
        &handle,
        "https://example.test/",
        "div",
        None,
        "T",
        &long_needle
    )
    .await
    .unwrap_err()
    .contains("exceeds"));
    assert!(
        open_preview(&handle, "https://example.test/", "div", None, "T", "M\0")
            .await
            .unwrap_err()
            .contains("null")
    );
}
