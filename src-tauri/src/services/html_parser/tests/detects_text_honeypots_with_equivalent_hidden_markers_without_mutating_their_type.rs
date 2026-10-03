use super::*;

#[test]
fn detects_text_honeypots_with_equivalent_hidden_markers_without_mutating_their_type() {
    let parsed = parse_html(
        r#"<html><body><form><input type="text" name="website_url" aria-hidden="1" value="secret-one"><input type="text" id="company-url" style="content-visibility:hidden!important" value="secret-two"><input type="text" name="homepage_url" style="display: none !important" value="secret-three"><input type="text" name="company_website" style="position:absolute; left:-9999px" value="secret-four"><input id="email" type="text" name="email" aria-hidden="1" value="private-email"><label for="email">E-mail</label></form></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.accessibility.form_control_count, 1);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 0);
    assert_eq!(parsed.accessibility.anti_spam_text_control_count, 4);
    assert_eq!(parsed.accessibility.anti_spam_text_controls.len(), 4);
    assert!(parsed
        .accessibility
        .anti_spam_text_controls
        .iter()
        .all(|control| control.html_snippet.contains("type=\"text\"")));
    assert!(parsed
        .accessibility
        .anti_spam_text_controls
        .iter()
        .all(|control| !control.html_snippet.contains("secret-")));
}

#[test]
fn legacy_accessibility_findings_deserialize_without_element_locations() {
    let finding: AccessibilityFinding = serde_json::from_str(
        r#"{"code":"legacy","severity":"warning","message":"Old finding","evidence":"Old evidence","recommendation":"Old recommendation"}"#,
    )
    .unwrap();

    assert!(finding.elements.is_empty());
}

#[test]
fn reports_static_wcag_related_markup_findings_with_evidence() {
    let parsed = parse_html(
        "<html lang=\"en_US\"><body><main></main><main></main><a href=\"/empty\"></a><button></button><img src=\"/photo.jpg\"><div id=\"duplicate\"></div><span id=\"duplicate\"></span><div aria-labelledby=\"missing-label\"></div></body></html>",
        "https://example.com",
    )
    .unwrap();

    let codes = parsed
        .accessibility
        .findings
        .iter()
        .map(|finding| finding.code.as_str())
        .collect::<HashSet<_>>();
    for expected in [
        "accessibility-document-language-invalid",
        "accessibility-multiple-main-landmarks",
        "accessibility-interactive-name-missing",
        "accessibility-image-alt-missing",
        "accessibility-duplicate-id",
        "accessibility-aria-reference-unresolved",
    ] {
        assert!(codes.contains(expected), "missing finding: {expected}");
    }
    assert!(parsed.accessibility.findings.iter().all(|finding| {
        !finding.message.is_empty()
            && !finding.evidence.is_empty()
            && !finding.recommendation.is_empty()
    }));
    let duplicate_id = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-duplicate-id")
        .expect("duplicate id finding");
    assert_eq!(duplicate_id.elements.len(), 2);
    assert_eq!(duplicate_id.elements[0].dom_position, 1);
    assert_eq!(duplicate_id.elements[0].line, Some(1));
    assert_eq!(
        duplicate_id.elements[0].dom_query,
        "document.querySelectorAll('[id]')[0]"
    );
    assert!(duplicate_id.elements[0]
        .html_snippet
        .contains("id=\"duplicate\""));
    let aria_reference = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-aria-reference-unresolved")
        .expect("unresolved ARIA reference finding");
    assert_eq!(aria_reference.elements.len(), 1);
    assert_eq!(aria_reference.elements[0].dom_position, 1);
    assert!(aria_reference.elements[0]
        .dom_query
        .starts_with("document.querySelectorAll('[aria-labelledby]"));
    assert!(aria_reference.elements[0]
        .html_snippet
        .contains("aria-labelledby=\"missing-label\""));
    let invalid_language = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-document-language-invalid")
        .expect("invalid document language finding");
    assert_eq!(invalid_language.elements.len(), 1);
    assert_eq!(
        invalid_language.elements[0].dom_query,
        "document.querySelectorAll('html')[0]"
    );
    assert!(invalid_language.elements[0]
        .html_snippet
        .contains("lang=\"en_US\""));
    let multiple_main = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-multiple-main-landmarks")
        .expect("multiple main finding");
    assert_eq!(multiple_main.elements.len(), 2);
    assert!(multiple_main.elements[0]
        .dom_query
        .starts_with("document.querySelectorAll(\"main, [role='main']\")[0]"));
    assert!(parsed.accessibility.manual_review_items.len() >= 3);
}
