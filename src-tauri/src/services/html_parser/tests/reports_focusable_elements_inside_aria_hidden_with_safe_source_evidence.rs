use super::*;

#[test]
fn reports_focusable_elements_inside_aria_hidden_with_safe_source_evidence() {
    let parsed = parse_html(
        r#"<html><body><div aria-hidden="true"><button id="hidden-action">Run</button><a href="/hidden">Hidden link</a><input type="text" name="honeypot" value="secret"><input type="text" id="disabled" disabled><input type="hidden" name="token" value="private"></div></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-focusable-aria-hidden")
        .expect("focusable aria-hidden elements should be reported");
    assert_eq!(finding.elements.len(), 2);
    assert!(finding.message.contains('2'));
    assert_eq!(finding.elements[0].dom_position, 1);
    assert_eq!(finding.elements[1].dom_position, 2);
    assert!(finding.elements[0].dom_query.contains("a[href]"));
    assert!(finding.elements[0].html_snippet.contains("hidden-action"));
    assert!(finding.elements[1]
        .html_snippet
        .contains("href=\"/hidden\""));
    assert_eq!(finding.elements[0].line, Some(1));
    assert!(finding.elements[0].column.is_some());
    assert!(!finding.elements[0].html_snippet.contains("secret"));
    assert!(!finding.elements[0].html_snippet.contains("private"));
}

#[test]
fn ignores_disabled_or_aria_disabled_focusable_elements_in_aria_hidden() {
    let parsed = parse_html(
        r#"<html><body><div aria-hidden="true"><button disabled>Disabled</button><a href="/disabled" aria-disabled="true">Disabled link</a><button hidden>Hidden</button><button inert>Inert</button><button style="display:none">CSS hidden</button><button aria-disabled="false">Allowed</button></div></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    let finding = parsed
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-focusable-aria-hidden")
        .expect("the enabled button should keep the finding present");
    assert_eq!(finding.elements.len(), 1);
    assert!(finding.elements[0]
        .html_snippet
        .contains("aria-disabled=\"false\""));
}

#[test]
fn does_not_change_antispam_text_field_type_when_inside_aria_hidden() {
    let parsed = parse_html(
        r#"<html><body><div aria-hidden="true"><input type="text" name="website" class="honeypot" value="secret"></div></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert!(parsed
        .accessibility
        .findings
        .iter()
        .all(|finding| finding.code != "accessibility-focusable-aria-hidden"));
    assert_eq!(parsed.accessibility.anti_spam_text_control_count, 1);
    assert!(parsed.accessibility.anti_spam_text_controls[0]
        .html_snippet
        .contains("type=\"text\""));
}

#[test]
fn recognizes_conventional_text_honeypot_hidden_by_aria_hidden_ancestor() {
    let parsed = parse_html(
        r#"<html><body><form><div aria-hidden="true"><input type="text" name="website" value="secret"></div><label for="email">Email</label><input id="email" type="email"></form></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.accessibility.form_control_count, 1);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 0);
    assert_eq!(parsed.accessibility.anti_spam_text_control_count, 1);
    assert!(parsed
        .accessibility
        .findings
        .iter()
        .all(|finding| { finding.code != "accessibility-focusable-aria-hidden" }));
    assert!(parsed.accessibility.anti_spam_text_controls[0]
        .html_snippet
        .contains("type=\"text\""));
}

#[test]
fn recognizes_conventional_text_honeypot_hidden_by_inert_or_css_ancestor() {
    let parsed = parse_html(
        r#"<html><body><form><div inert><input type="text" name="website" value="secret-one"></div><div style="display:none!important"><input type="text" name="company_url" value="secret-two"></div><label for="email">Email</label><input id="email" type="email"></form></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.accessibility.form_control_count, 1);
    assert_eq!(parsed.accessibility.unlabeled_form_control_count, 0);
    assert_eq!(parsed.accessibility.anti_spam_text_control_count, 2);
    assert!(parsed
        .accessibility
        .anti_spam_text_controls
        .iter()
        .all(|field| {
            field.html_snippet.contains("type=\"text\"") && !field.html_snippet.contains("secret-")
        }));
}

#[test]
fn ignores_script_and_style_payload_in_body_text() {
    let parsed = parse_html(
        "<html><body><p>Visible audit copy</p><script>secretKeyphrase()</script><style>.secret{display:none}</style></body></html>",
        "https://example.com",
    )
    .unwrap();

    assert!(parsed
        .content_stats
        .body_text
        .contains("Visible audit copy"));
    assert!(!parsed.content_stats.body_text.contains("secretKeyphrase"));
}
