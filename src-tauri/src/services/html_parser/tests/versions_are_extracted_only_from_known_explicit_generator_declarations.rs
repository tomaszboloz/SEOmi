use super::*;

#[test]
fn versions_are_extracted_only_from_known_explicit_generator_declarations() {
    let declared = parse_html(
        "<html><head><meta name=\"generator\" content=\"WordPress 6.6.2\"></head><body><img src=\"/wp-content/logo.png\"></body></html>",
        "https://example.com",
    )
    .unwrap();
    let wordpress = declared
        .technical
        .technology_signals
        .iter()
        .find(|signal| signal.name == "WordPress")
        .unwrap();
    assert_eq!(wordpress.version.as_deref(), Some("6.6.2"));
    assert_eq!(wordpress.confidence, "confirmed");

    let heuristic = parse_html(
        "<html><body><img src=\"/wp-content/logo.png\"></body></html>",
        "https://example.com",
    )
    .unwrap();
    let wordpress = heuristic
        .technical
        .technology_signals
        .iter()
        .find(|signal| signal.name == "WordPress")
        .unwrap();
    assert_eq!(wordpress.version, None);
    assert_eq!(wordpress.confidence, "heuristic");

    let lookalike = parse_html(
        "<html><head><meta name=\"generator\" content=\"WordPressish 99.0\"></head></html>",
        "https://example.com",
    )
    .unwrap();
    assert!(!lookalike
        .technical
        .technology_signals
        .iter()
        .any(|signal| signal.name == "WordPress"));
}

#[test]
fn extracts_document_language_landmarks_aria_and_unlabeled_controls() {
    let parsed = parse_html(
        "<html lang=\"pl\"><body><header><nav aria-label=\"Główna\"></nav></header><main><label for=\"email\">E-mail</label><input id=\"email\"><input name=\"without-label\"></main></body></html>",
        "https://example.com",
    )
    .unwrap();

    assert_eq!(
        parsed.accessibility.document_language.as_deref(),
        Some("pl")
    );
    assert!(parsed
        .accessibility
        .landmarks
        .iter()
        .any(|landmark| landmark.name == "main" && landmark.count == 1));
    assert_eq!(parsed.accessibility.aria_attribute_count, 1);
    assert_eq!(parsed.accessibility.form_control_count, 2);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 1);
}

#[test]
fn unlabeled_control_finding_identifies_source_position_and_redacts_control_values() {
    let parsed = parse_html(
        r#"<html><body><input type="hidden" name="csrf" value="private-token"><input type="text" name="company-honeypot" class="honeypot" value="private-honeypot"><label for="email">Email</label><input id="email"><form><input type="email" name="contact" placeholder="name@example.com" value="private-email" data-secret="private-data"><textarea name="message"></textarea><select name="plan"><option>Basic</option></select></form></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.accessibility.anti_spam_text_control_count, 1);
    assert_eq!(parsed.accessibility.form_control_count, 4);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 3);
    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-form-controls-unlabeled")
        .unwrap();

    assert_eq!(finding.elements.len(), 3);
    assert_eq!(finding.elements[0].dom_position, 4);
    assert_eq!(finding.elements[0].line, Some(1));
    assert!(finding.elements[0].column.is_some());
    assert_eq!(
        finding.elements[0].dom_query,
        "document.querySelectorAll('input, select, textarea')[3]"
    );
    assert!(finding.elements[0].html_snippet.contains("type=\"email\""));
    assert!(finding.elements[0]
        .html_snippet
        .contains("name=\"contact\""));
    assert!(!finding.elements[0].html_snippet.contains("private-email"));
    assert!(!finding.elements[0].html_snippet.contains("private-token"));
    assert!(!finding.elements[0].html_snippet.contains("private-data"));
    assert!(finding
        .elements
        .iter()
        .any(|element| element.html_snippet.starts_with("<textarea")));
    assert!(finding
        .elements
        .iter()
        .any(|element| element.html_snippet.starts_with("<select")));
    assert_eq!(parsed.accessibility.hidden_form_control_count, 1);
    assert_eq!(parsed.accessibility.anti_spam_text_controls.len(), 1);
    assert!(parsed.accessibility.anti_spam_text_controls[0]
        .html_snippet
        .contains("type=\"text\""));
    assert!(parsed.accessibility.anti_spam_text_controls[0]
        .html_snippet
        .contains("honeypot"));
    assert!(!parsed.accessibility.anti_spam_text_controls[0]
        .html_snippet
        .contains("private-honeypot"));
    assert_eq!(
        parsed.accessibility.hidden_form_controls[0].dom_query,
        "document.querySelectorAll('input, select, textarea')[0]"
    );
    assert!(parsed.accessibility.hidden_form_controls[0]
        .html_snippet
        .contains("type=\"hidden\""));
    assert!(!parsed.accessibility.hidden_form_controls[0]
        .html_snippet
        .contains("private-token"));
}
