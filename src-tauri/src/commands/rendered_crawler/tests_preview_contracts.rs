use super::{
    models::{PREVIEW_NEEDLE_MAX_CHARS, PREVIEW_SELECTOR_MAX_CHARS},
    preview::{normalize_preview_value, open_rendered_element_preview},
};
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;

async fn preview_err(
    app: &StorageApp,
    url: &str,
    selector: &str,
    needle: Option<&str>,
    title: &str,
    msg: &str,
) -> String {
    open_rendered_element_preview(
        app.handle(),
        url.into(),
        selector.into(),
        needle.map(Into::into),
        None,
        title.into(),
        msg.into(),
    )
    .await
    .unwrap_err()
}

#[tokio::test]
async fn open_rendered_element_preview_validates_url() {
    let app = StorageApp::new(mock_builder());
    for (url, expected) in [
        ("", "Empty URL provided"),
        ("ftp://example.test/", "Unsupported scheme 'ftp'"),
        (
            "http://localhost:3000/",
            "Access to localhost or local network addresses is blocked",
        ),
        (
            "http://192.168.1.1/",
            "Access to local/private IP addresses is blocked",
        ),
    ] {
        let err = preview_err(&app, url, "div", None, "Title", "Missing").await;
        assert!(err.contains(expected), "url {url} got {err}");
    }
}

#[tokio::test]
async fn open_rendered_element_preview_validates_selector_and_needle() {
    let app = StorageApp::new(mock_builder());
    for (selector, expected) in [
        ("", "Preview selector cannot be empty."),
        ("   ", "Preview selector cannot be empty."),
        (
            "div\0span",
            "Preview selector contains an invalid null character.",
        ),
    ] {
        let err = preview_err(
            &app,
            "https://example.test/",
            selector,
            None,
            "Title",
            "Missing",
        )
        .await;
        assert_eq!(err, expected);
    }
    let too_long_sel = "a".repeat(PREVIEW_SELECTOR_MAX_CHARS + 1);
    let err = preview_err(
        &app,
        "https://example.test/",
        &too_long_sel,
        None,
        "Title",
        "Missing",
    )
    .await;
    assert_eq!(
        err,
        format!(
            "Preview selector exceeds the {PREVIEW_SELECTOR_MAX_CHARS}-character safety limit."
        )
    );

    for (needle, expected) in [
        ("", "Preview match text cannot be empty."),
        ("   ", "Preview match text cannot be empty."),
        (
            "n\0dle",
            "Preview match text contains an invalid null character.",
        ),
    ] {
        let err = preview_err(
            &app,
            "https://example.test/",
            "div",
            Some(needle),
            "Title",
            "Missing",
        )
        .await;
        assert_eq!(err, expected);
    }
    let too_long_needle = "m".repeat(PREVIEW_NEEDLE_MAX_CHARS + 1);
    let err = preview_err(
        &app,
        "https://example.test/",
        "div",
        Some(&too_long_needle),
        "Title",
        "Missing",
    )
    .await;
    assert_eq!(
        err,
        format!(
            "Preview match text exceeds the {PREVIEW_NEEDLE_MAX_CHARS}-character safety limit."
        )
    );
}

#[path = "tests_preview_text_contracts.rs"]
mod text_contracts;
