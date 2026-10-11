use super::*;

#[test]
fn test_normalize_preview_value_valid_and_boundaries() {
    assert_eq!(
        normalize_preview_value("  span  ", "F", 20).unwrap(),
        "span"
    );
    let exact = "x".repeat(15);
    assert_eq!(normalize_preview_value(&exact, "F", 15).unwrap(), exact);
    assert!(normalize_preview_value(&"x".repeat(16), "F", 15)
        .unwrap_err()
        .contains("exceeds"));
    assert!(normalize_preview_value("   ", "F", 50)
        .unwrap_err()
        .contains("cannot be empty"));
    assert!(normalize_preview_value("a\0b", "F", 50)
        .unwrap_err()
        .contains("invalid null"));
}

#[tokio::test]
async fn test_open_rendered_element_preview_valid_runs() {
    let app = StorageApp::new(mock_builder());
    let handle = app.handle();
    assert!(open_preview(
        &handle,
        "https://example.test/item",
        "btn",
        Some("Add"),
        "Title",
        "Msg"
    )
    .await
    .is_ok());
    assert!(open_preview(
        &handle,
        "https://example.test/page",
        "div",
        None,
        "Title",
        "Msg"
    )
    .await
    .is_ok());
}
