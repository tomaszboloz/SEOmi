use super::*;
#[test]
fn source_offsets_ignore_comments_and_script_literals_and_preserve_unicode_columns() {
    let source = "<!-- <input> --><script>let x='<input>';</script>\ną<input id='one'>\n<textarea></textarea>";
    let first = source.find("<input id").unwrap();
    assert_eq!(form_control_source_offset(source, 1), Some(first));
    assert_eq!(form_control_source_offset(source, 0), None);
    assert_eq!(form_control_source_offset(source, 3), None);
    assert_eq!(source_line_column(source, first), (Some(2), Some(2)));
    assert_eq!(source_line_column("ą", 1), (None, None));
    let doc = Html::parse_document(source);
    let selector = Selector::parse("input").unwrap();
    let input = doc.select(&selector).next().unwrap();
    assert_eq!(
        element_source_offset(source, 1, &input, "[id]"),
        Some(first)
    );
    assert_eq!(element_source_offset(source, 0, &input, "[id]"), None);
    let evidence = accessibility_control_evidence(&input, 1, source);
    assert_eq!(evidence.line, Some(2));
    assert_eq!(evidence.column, Some(2));
    let named = accessibility_element_evidence(&input, 1, "[id]", source);
    assert_eq!(named.dom_position, 1);
    assert_eq!(named.line, Some(2));
}
#[test]
fn attribute_and_selector_helpers_distinguish_boolean_quoted_and_unquoted_evidence() {
    let tag = "<input id='one' name=two disabled aria-label=\"Name\">";
    assert_eq!(source_attribute_value(tag, "id"), Some("one".into()));
    assert_eq!(source_attribute_value(tag, "name"), Some("two".into()));
    assert_eq!(source_attribute_value(tag, "disabled"), Some(String::new()));
    assert_eq!(source_attribute_value(tag, "missing"), None);
    assert!(source_tag_matches_selector(tag, "input", "[id]"));
    assert!(!source_tag_matches_selector(
        "<img alt=''>",
        "img",
        "img:not([alt])"
    ));
    assert_eq!(
        accessibility_dom_query("input", 0),
        "document.querySelectorAll('input')[0]"
    );
    assert_eq!(
        accessibility_dom_query("[role='main']", 1),
        "document.querySelectorAll(\"[role='main']\")[1]"
    );
}
#[test]
fn snippets_redact_values_and_query_tokens_without_losing_safe_attributes() {
    let source = "<input name='email' value='secret' placeholder='&quot;Name&quot;' required><a href='https://site.test/path?secret=1#token'>Link</a>";
    let doc = Html::parse_document(source);
    let input = doc
        .select(&Selector::parse("input").unwrap())
        .next()
        .unwrap();
    let snippet = accessibility_control_snippet(&input);
    assert!(!snippet.contains("secret"));
    assert!(snippet.contains("required"));
    assert!(snippet.contains("&quot;Name&quot;"));
    let link = doc.select(&Selector::parse("a").unwrap()).next().unwrap();
    let snippet = accessibility_element_snippet(&link);
    assert!(snippet.contains("https://site.test/path"));
    assert!(!snippet.contains("secret"));
}
