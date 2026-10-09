use super::*;

#[test]
fn bounded_link_source_excerpt_redaction_and_length_capping() {
    let html = r#"<html><body><main>
        <a href="/target" value=unquoted_secret onclick='runHandler()' onmouseover="hoverAlert()">Link Text</a>
    </main></body></html>"#;
    let doc = Html::parse_document(html);
    let anchor = doc.select(&Selector::parse("a").unwrap()).next().unwrap();
    let excerpt = bounded_link_source_excerpt(&anchor).unwrap();
    assert!(excerpt.contains("/target"));
    assert!(excerpt.contains(r#"value="[redacted]""#));
    assert!(excerpt.contains(r#"on[redacted]="[redacted]""#));
    assert!(!excerpt.contains("unquoted_secret"));
    assert!(!excerpt.contains("runHandler"));
    assert!(!excerpt.contains("hoverAlert"));

    let long_attr = "a".repeat(1000);
    let long_html = format!(
        r#"<html><body><main><a href="/long" data-desc="{long_attr}">Text</a></main></body></html>"#
    );
    let long_doc = Html::parse_document(&long_html);
    let long_anchor = long_doc
        .select(&Selector::parse("a").unwrap())
        .next()
        .unwrap();
    let capped = bounded_link_source_excerpt(&long_anchor).unwrap();
    assert_eq!(capped.chars().count(), 800);
}

#[test]
fn extract_semantic_terms_ignores_scripts_templates_and_handles_missing_body() {
    let no_body = Html::parse_fragment("<div>Just a stray div</div>");
    assert!(extract_semantic_terms(&no_body, None).is_empty());

    let document = Html::parse_document(
        r#"<html><body>
            <script>const scriptkeyword = 1;</script>
            <style>.stylekeyword { color: red; }</style>
            <noscript>noscriptkeyword</noscript>
            <svg><text>svgkeyword</text></svg>
            <template><p>templatekeyword</p></template>
            <main>
                <p>Authentic semantic content for crawler evaluation.</p>
            </main>
        </body></html>"#,
    );
    let terms = extract_semantic_terms(&document, Some("en"));
    assert!(terms.contains(&"authentic".to_string()));
    assert!(terms.contains(&"crawler".to_string()));
    assert!(!terms.contains(&"scriptkeyword".to_string()));
    assert!(!terms.contains(&"stylekeyword".to_string()));
    assert!(!terms.contains(&"noscriptkeyword".to_string()));
    assert!(!terms.contains(&"svgkeyword".to_string()));
    assert!(!terms.contains(&"templatekeyword".to_string()));
}

#[test]
fn extract_semantic_excerpts_selectors_length_bounds_and_deduplication() {
    let document = Html::parse_document(
        r#"<html><body><main>
            <p>Short</p>
            <h1>Heading that exceeds the minimum required length of twenty four characters.</h1>
            <blockquote>Blockquote content with plenty of meaningful text for auditing.</blockquote>
            <li>List item entry with enough length to be accepted as a valid excerpt.</li>
            <p>Duplicate paragraph entry with enough length to be accepted as a valid excerpt.</p>
            <p>Duplicate paragraph entry with enough length to be accepted as a valid excerpt.</p>
        </main></body></html>"#,
    );
    let excerpts = extract_semantic_excerpts(&document);
    assert!(!excerpts.iter().any(|e| e == "Short"));
    assert!(excerpts
        .iter()
        .any(|e| e.starts_with("Heading that exceeds")));
    assert!(excerpts.iter().any(|e| e.starts_with("Blockquote content")));
    assert!(excerpts.iter().any(|e| e.starts_with("List item entry")));
    let dup_count = excerpts
        .iter()
        .filter(|e| e.starts_with("Duplicate paragraph entry"))
        .count();
    assert_eq!(dup_count, 1);
}
