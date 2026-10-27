use super::preview::{
    build_preview_script, normalize_preview_value, open_rendered_element_preview,
};
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;

#[test]
fn normalize_preview_value_strictly_checks_boundaries() {
    assert_eq!(
        normalize_preview_value("  article.post  ", "field", 50).unwrap(),
        "article.post"
    );

    // Exact limit succeeds
    let exact = "a".repeat(10);
    assert_eq!(normalize_preview_value(&exact, "field", 10).unwrap(), exact);

    // Exceeding limit by 1 character fails
    let too_long = "a".repeat(11);
    assert!(normalize_preview_value(&too_long, "field", 10).is_err());

    // Null characters are rejected anywhere in string
    assert!(normalize_preview_value("\0abc", "field", 10).is_err());
    assert!(normalize_preview_value("abc\0", "field", 10).is_err());
    assert!(normalize_preview_value("a\0c", "field", 10).is_err());

    // Empty and whitespace only strings fail
    assert!(normalize_preview_value("", "field", 10).is_err());
    assert!(normalize_preview_value("   ", "field", 10).is_err());
}

#[test]
fn preview_script_preserves_json_escaping_and_arguments() {
    let script = build_preview_script(
        r##"div[data-label="a\b"]"##,
        Some("A \"quoted\"\nresult"),
        Some(2),
        "Missing <item>",
    );
    assert!(script.contains(r##"const selector = "div[data-label=\"a\\b\"]";"##));
    assert!(script.contains(r##"const needle = "A \"quoted\"\nresult";"##));
    assert!(script.contains("const domIndex = 2;"));
    assert!(script.contains(r##"const notFoundMessage = "Missing <item>";"##));
    assert!(script.contains("querySelectorAll(selector)"));
}

#[tokio::test]
async fn open_rendered_element_preview_covers_argument_combinations() {
    let app = StorageApp::new(mock_builder());

    // No needle, no dom_index
    let res1 = open_rendered_element_preview(
        app.handle(),
        "https://example.test/page?query=1#frag".into(),
        "header > nav".into(),
        None,
        None,
        "Header Nav Preview".into(),
        "Nav not found".into(),
    )
    .await;
    assert!(res1.is_ok());

    // Needle without dom_index
    let res2 = open_rendered_element_preview(
        app.handle(),
        "https://example.test/blog".into(),
        "a.read-more".into(),
        Some("Continue Reading".into()),
        None,
        "Read More Link".into(),
        "Link not found".into(),
    )
    .await;
    assert!(res2.is_ok());

    // dom_index without needle
    let res3 = open_rendered_element_preview(
        app.handle(),
        "https://example.test/gallery".into(),
        "img.thumbnail".into(),
        None,
        Some(2),
        "Third Thumbnail".into(),
        "Image not found".into(),
    )
    .await;
    assert!(res3.is_ok());

    // Both needle and dom_index
    let res4 = open_rendered_element_preview(
        app.handle(),
        "https://example.test/catalog".into(),
        "button.buy".into(),
        Some("Add to Cart".into()),
        Some(0),
        "Primary Buy Button".into(),
        "Button not found".into(),
    )
    .await;
    assert!(res4.is_ok());
}

#[tokio::test]
async fn open_rendered_element_preview_rejects_invalid_inputs() {
    let app = StorageApp::new(mock_builder());

    // Unsupported scheme
    let res = open_rendered_element_preview(
        app.handle(),
        "ftp://example.test/file".into(),
        "div".into(),
        None,
        None,
        "Title".into(),
        "Missing".into(),
    )
    .await;
    assert!(res.is_err());

    // Private IP
    let res = open_rendered_element_preview(
        app.handle(),
        "http://127.0.0.1:3000/".into(),
        "div".into(),
        None,
        None,
        "Title".into(),
        "Missing".into(),
    )
    .await;
    assert!(res.is_err());

    // Invalid title containing null
    let res = open_rendered_element_preview(
        app.handle(),
        "https://example.test/".into(),
        "div".into(),
        None,
        None,
        "Bad\0Title".into(),
        "Missing".into(),
    )
    .await;
    assert!(res.is_err());
}
