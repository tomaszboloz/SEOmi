use super::*;

#[test]
fn bounded_link_source_excerpt_quoted_attributes_and_redaction() {
    let html = r#"<html><body><main>
        <a href="/target" value="double_secret" onclick="handleEvent()" onsubmit='singleSubmit()'>Target</a>
    </main></body></html>"#;
    let doc = Html::parse_document(html);
    let anchor = doc.select(&Selector::parse("a").unwrap()).next().unwrap();
    let excerpt = bounded_link_source_excerpt(&anchor).unwrap();
    assert!(excerpt.contains("/target"));
    assert!(excerpt.contains(r#"value="[redacted]""#));
    assert!(excerpt.contains(r#"on[redacted]="[redacted]""#));
    assert!(!excerpt.contains("double_secret"));
    assert!(!excerpt.contains("handleEvent"));
    assert!(!excerpt.contains("singleSubmit"));
}

#[test]
fn semantic_content_source_evaluates_all_branches() {
    let doc_root =
        Html::parse_document("<html><body><main><p>Main content</p></main></body></html>");
    let doc_fallback =
        Html::parse_document("<html><body><div><p>Fallback content</p></div></body></html>");

    assert_eq!(
        semantic_content_source(&doc_root, false, false, false),
        "unavailable"
    );
    assert_eq!(
        semantic_content_source(&doc_root, true, true, false),
        "unavailable"
    );
    assert_eq!(
        semantic_content_source(&doc_root, true, false, true),
        "unavailable"
    );
    assert_eq!(
        semantic_content_source(&doc_root, true, false, false),
        "primary-root"
    );
    assert_eq!(
        semantic_content_source(&doc_fallback, true, false, false),
        "body-fallback"
    );
}

#[test]
fn extract_semantic_terms_filters_nested_ancestor_scripts_and_templates() {
    let doc = Html::parse_document(
        r#"<html><body>
            <template><div><span>nested_template_word</span></div></template>
            <svg><g><text>nested_svg_word</text></g></svg>
            <main><p>Valid semantic body content.</p></main>
        </body></html>"#,
    );
    let terms = extract_semantic_terms(&doc, Some("en"));
    assert!(terms.contains(&"valid".to_string()));
    assert!(terms.contains(&"semantic".to_string()));
    assert!(!terms.contains(&"nested_template_word".to_string()));
    assert!(!terms.contains(&"nested_svg_word".to_string()));
}

#[test]
fn extract_semantic_excerpts_bounds_and_capping() {
    let mut markup = String::from("<html><body><main>");
    markup.push_str("<p>Short</p>");
    let long_para = format!("<p>{}</p>", "z".repeat(965));
    markup.push_str(&long_para);
    for i in 0..12 {
        markup.push_str(&format!(
            "<p>Standard sentence with enough length to count as excerpt {}.</p>",
            i
        ));
    }
    markup.push_str("</main></body></html>");
    let doc = Html::parse_document(&markup);
    let excerpts = extract_semantic_excerpts(&doc);
    assert_eq!(excerpts.len(), MAX_SEMANTIC_EXCERPTS_PER_PAGE);
    assert!(!excerpts.iter().any(|e| e == "Short"));
    assert!(!excerpts.iter().any(|e| e.starts_with("zzzz")));
}
