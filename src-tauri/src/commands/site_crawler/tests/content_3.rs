use super::*;

#[test]
fn hidden_primary_root_does_not_suppress_visible_body_fallback() {
    let document = Html::parse_document(
        r#"<html><body><main hidden><p>hidden primary root term</p></main><div><p>Visible fallback article content.</p></div></body></html>"#,
    );
    assert!(!has_semantic_content_root(&document));
    let terms = extract_semantic_terms(&document, None);
    assert!(terms.contains(&"visible".to_string()));
    assert!(!terms.contains(&"hidden".to_string()));
    assert_eq!(
        semantic_content_source(&document, true, false, false),
        "body-fallback"
    );
}

#[test]
fn semantic_source_identifies_primary_fallback_and_unavailable_documents() {
    let primary =
        Html::parse_document("<html><body><main><p>Rendered content</p></main></body></html>");
    assert_eq!(
        semantic_content_source(&primary, true, false, false),
        "primary-root"
    );

    let fallback = Html::parse_document(
        "<html><body><div><p>Rendered fallback content</p></div></body></html>",
    );
    assert_eq!(
        semantic_content_source(&fallback, true, false, false),
        "body-fallback"
    );

    assert_eq!(
        semantic_content_source(&primary, false, false, false),
        "unavailable"
    );
    assert_eq!(
        semantic_content_source(&primary, true, true, false),
        "unavailable"
    );
    assert_eq!(
        semantic_content_source(&primary, true, false, true),
        "unavailable"
    );
}

#[test]
fn semantic_provenance_distinguishes_rendered_and_http_snapshots() {
    assert_eq!(
        semantic_provenance_for_mode("browser-rendered", "primary-root"),
        "rendered"
    );
    assert_eq!(
        semantic_provenance_for_mode("http", "body-fallback"),
        "http"
    );
    assert_eq!(
        semantic_provenance_for_mode("browser-rendered", "unavailable"),
        "unavailable"
    );
}

#[test]
fn semantic_partial_flag_is_conservative_at_each_bound() {
    assert!(!semantic_content_is_partial(false, false, 39, 7, 999));
    assert!(semantic_content_is_partial(true, false, 0, 0, 0));
    assert!(semantic_content_is_partial(false, true, 0, 0, 0));
    assert!(semantic_content_is_partial(false, false, 40, 0, 0));
    assert!(semantic_content_is_partial(false, false, 0, 8, 0));
    assert!(semantic_content_is_partial(false, false, 0, 0, 1_000));
}
