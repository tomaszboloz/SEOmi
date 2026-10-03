use super::*;

#[test]
fn accessibility_control_evidence_reports_multiline_source_location() {
    let parsed = parse_html(
        "<html>\n<body>\n<!-- <input name=\"fake-comment\"> -->\n<script>const fake = '<input name=\"fake-script\">';</script>\n<form>\n<input type=\"email\" name=\"contact\">\n</form>\n</body>\n</html>",
        "https://example.com",
    )
    .unwrap();

    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-form-controls-unlabeled")
        .unwrap();
    assert_eq!(finding.elements.len(), 1);
    assert_eq!(finding.elements[0].line, Some(6));
    assert_eq!(finding.elements[0].column, Some(1));
}

#[test]
fn empty_aria_labelledby_reference_does_not_hide_an_unlabelled_control() {
    let parsed = parse_html(
        r#"<html><body><span id="empty-label"></span><input type="email" aria-labelledby="empty-label"><span id="real-label">Email</span><input type="email" aria-labelledby="real-label"></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.accessibility.form_control_count, 2);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 1);
    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-form-controls-unlabeled")
        .expect("empty aria-labelledby should be reported");
    assert_eq!(finding.elements.len(), 1);
    assert!(finding.elements[0]
        .html_snippet
        .contains("aria-labelledby=\"empty-label\""));
}

#[test]
fn accessibility_non_form_findings_report_selectors_source_locations_and_safe_snippets() {
    let parsed = parse_html(
        r#"<html><body><a href="/empty"></a><button></button><div role="button"></div><img src="/without-alt.png?token=private#frag"><img alt="" src="/decorative.png"></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    let interactive = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-interactive-name-missing")
        .expect("unnamed interactive finding");
    assert_eq!(interactive.elements.len(), 3);
    assert_eq!(
        interactive.elements[0].dom_query,
        "document.querySelectorAll(\"a[href], button, input[type='button'], input[type='submit'], input[type='reset'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']\")[0]"
    );
    assert_eq!(interactive.elements[0].line, Some(1));
    assert!(interactive.elements[0].html_snippet.starts_with("<a"));
    assert!(interactive.elements[1].html_snippet.starts_with("<button"));
    assert!(interactive.elements[2]
        .html_snippet
        .contains("role=\"button\""));

    let images = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-image-alt-missing")
        .expect("missing image alt finding");
    assert_eq!(images.elements.len(), 1);
    assert_eq!(
        images.elements[0].dom_query,
        "document.querySelectorAll('img:not([alt])')[0]"
    );
    assert_eq!(images.elements[0].line, Some(1));
    assert!(images.elements[0]
        .html_snippet
        .contains("src=\"/without-alt.png\""));
    assert!(!images.elements[0].html_snippet.contains("private"));
    assert!(!images.elements[0].html_snippet.contains("decorative.png"));
}

#[test]
fn reports_unnamed_custom_interactive_roles() {
    let parsed = parse_html(
        r#"<html><body><div role="checkbox"></div><span role="tab"></span><div role="link" aria-label="Named link"></div></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-interactive-name-missing")
        .expect("unnamed custom roles should be reported");
    assert_eq!(finding.elements.len(), 2);
    assert!(finding.elements[0]
        .html_snippet
        .contains("role=\"checkbox\""));
    assert!(finding.elements[1].html_snippet.contains("role=\"tab\""));
}

#[test]
fn flags_marked_honeypots_that_use_hidden_type_without_counting_them_as_visible_controls() {
    let parsed = parse_html(
        r#"<html><body><form><input type="hidden" name="website" value="secret"><input type="hidden" name="website-honeypot" value="secret-too"><input type="text" name="company-honeypot" class="honeypot" value="also-secret"><label for="email">Email</label><input id="email" type="email"></form></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.accessibility.form_control_count, 1);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 0);
    assert_eq!(parsed.accessibility.hidden_form_control_count, 2);
    assert_eq!(parsed.accessibility.anti_spam_text_control_count, 1);
    assert!(parsed.accessibility.anti_spam_text_controls[0]
        .html_snippet
        .contains("type=\"text\""));

    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-antispam-control-not-text")
        .expect("a honeypot marked as type=hidden should be reported");
    assert_eq!(finding.elements.len(), 2);
    assert_eq!(finding.elements[0].dom_position, 1);
    assert!(finding.elements[0].html_snippet.contains("type=\"hidden\""));
    assert!(finding.elements[0]
        .html_snippet
        .contains("name=\"website\""));
    assert!(!finding.elements[0].html_snippet.contains("secret"));
    assert!(finding.recommendation.contains("type=\"text\""));
    assert!(finding.recommendation.contains("type=\"hidden\""));
}
