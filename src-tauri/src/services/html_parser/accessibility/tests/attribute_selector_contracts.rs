use super::*;

const NAMED: &str = "a[href], button, input[type='button'], input[type='submit'], input[type='reset'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']";
const FOCUS: &str = "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']";

#[test]
fn source_attribute_reader_handles_boolean_quoted_unquoted_and_tag_boundaries() {
    let tag = r#"<input disabled data = 'a>b' name=plain aria-label="Name">"#;
    assert_eq!(source_attribute_value(tag, "disabled"), Some(String::new()));
    assert_eq!(source_attribute_value(tag, "data"), Some("a>b".into()));
    assert_eq!(source_attribute_value(tag, "name"), Some("plain".into()));
    assert_eq!(
        source_attribute_value(tag, "aria-label"),
        Some("Name".into())
    );
    assert_eq!(
        source_attribute_value("<input id='unfinished", "id"),
        Some("unfinished".into())
    );
    assert_eq!(
        source_attribute_value("<input id>", "id"),
        Some(String::new())
    );
    assert!(source_attribute_value("<input data='x'> outside='y'", "outside").is_none());
}

#[test]
fn source_selector_matching_distinguishes_missing_attributes_and_control_roles() {
    assert!(source_tag_matches_selector(
        "<img>",
        "img",
        "img:not([alt])"
    ));
    assert!(!source_tag_matches_selector(
        "<img alt=''>",
        "img",
        "img:not([alt])"
    ));
    assert!(source_tag_matches_selector("<a href=''>", "a", NAMED));
    assert!(!source_tag_matches_selector("<a>", "a", NAMED));
    assert!(!source_tag_matches_selector(
        "<input type='hidden'>",
        "input",
        FOCUS
    ));
    assert!(source_tag_matches_selector("<input>", "input", FOCUS));
    assert!(source_tag_matches_selector("<div aria-details='id'>", "div", "[aria-labelledby], [aria-describedby], [aria-controls], [aria-owns], [aria-flowto], [aria-details], [aria-errormessage]"));
    assert!(source_tag_matches_selector(
        "<div role='LINK'>",
        "div",
        NAMED
    ));
    assert!(!source_tag_matches_selector(
        "<div role='none'>",
        "div",
        NAMED
    ));
}

#[test]
fn accessibility_extractors_skip_script_style_content_and_bound_samples() {
    let source = format!(
        "<script><button></button><img></script><style><img></style>{}",
        "<button></button><img>".repeat(60)
    );
    let document = Html::parse_document(&source);
    let mut codes = Vec::new();
    let unnamed = interactive_elements(
        &document,
        &source,
        &HashSet::new(),
        &mut |code, _, _, _, _| codes.push(code.to_string()),
    );
    let images = image_elements(&document, &source, &mut |code, _, _, _, _| {
        codes.push(code.to_string())
    });
    assert_eq!(unnamed.len(), 50);
    assert_eq!(images.len(), 50);
    assert_eq!(
        codes,
        vec![
            "accessibility-interactive-name-missing",
            "accessibility-image-alt-missing"
        ]
    );
    assert!(codes.iter().all(|code| !code.contains("script")));
}

#[test]
fn accessibility_snippet_keeps_safe_attributes_redacts_values_and_escapes_markup() {
    let source = r#"<button id="x" title="<&" value="secret" required aria-label="Go">Go</button>"#;
    let document = Html::parse_document(source);
    let button = document
        .select(&Selector::parse("button").unwrap())
        .next()
        .unwrap();
    let snippet = accessibility_control_snippet(&button);
    assert!(snippet.contains("id=\"x\""));
    assert!(snippet.contains("title=\"&lt;&amp;\""));
    assert!(snippet.contains("required"));
    assert!(!snippet.contains("secret"));
}
