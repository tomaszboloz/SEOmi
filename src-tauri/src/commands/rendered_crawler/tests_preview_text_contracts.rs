use super::*;

#[tokio::test]
async fn open_rendered_element_preview_validates_title_and_message() {
    let app = StorageApp::new(mock_builder());
    for (title, expected) in [
        ("", "Preview window title cannot be empty."),
        ("   ", "Preview window title cannot be empty."),
        (
            "Bad\0Title",
            "Preview window title contains an invalid null character.",
        ),
    ] {
        let err = preview_err(&app, "https://example.test/", "div", None, title, "Missing").await;
        assert_eq!(err, expected);
    }
    let too_long_title = "t".repeat(PREVIEW_SELECTOR_MAX_CHARS + 1);
    let err = preview_err(
        &app,
        "https://example.test/",
        "div",
        None,
        &too_long_title,
        "Missing",
    )
    .await;
    assert_eq!(
        err,
        format!(
            "Preview window title exceeds the {PREVIEW_SELECTOR_MAX_CHARS}-character safety limit."
        )
    );

    for (msg, expected) in [
        ("", "Preview not-found message cannot be empty."),
        ("   ", "Preview not-found message cannot be empty."),
        (
            "Bad\0Msg",
            "Preview not-found message contains an invalid null character.",
        ),
    ] {
        let err = preview_err(&app, "https://example.test/", "div", None, "Title", msg).await;
        assert_eq!(err, expected);
    }
    let too_long_msg = "m".repeat(PREVIEW_NEEDLE_MAX_CHARS + 1);
    let err = preview_err(
        &app,
        "https://example.test/",
        "div",
        None,
        "Title",
        &too_long_msg,
    )
    .await;
    assert_eq!(err, format!("Preview not-found message exceeds the {PREVIEW_NEEDLE_MAX_CHARS}-character safety limit."));
}

#[test]
fn normalize_preview_value_additional_edge_cases() {
    let unicode = "🦀".repeat(50);
    assert_eq!(
        normalize_preview_value(&unicode, "crab", 50).unwrap(),
        unicode
    );
    let unicode_overflow = "🦀".repeat(51);
    assert!(normalize_preview_value(&unicode_overflow, "crab", 50).is_err());
    assert_eq!(
        normalize_preview_value("  hello\0world  ", "val", 100).unwrap_err(),
        "val contains an invalid null character."
    );
}
