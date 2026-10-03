use super::*;

const NAMED: &str = "a[href], button, input[type='button'], input[type='submit'], input[type='reset'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']";
const FOCUS: &str = "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']";

#[test]
fn source_selector_matching_preserves_named_and_focusable_control_contracts() {
    for input_type in ["button", "submit", "reset", "BUTTON"] {
        assert!(source_tag_matches_selector(
            &format!("<input type='{input_type}'>"),
            "input",
            NAMED
        ));
    }
    assert!(!source_tag_matches_selector(
        "<input type='text'>",
        "input",
        NAMED
    ));
    for role in [
        "button", "link", "checkbox", "radio", "switch", "tab", "menuitem",
    ] {
        let tag = format!("<div role='{role}'>");
        assert!(source_tag_matches_selector(&tag, "div", NAMED));
        assert!(source_tag_matches_selector(&tag, "div", FOCUS));
    }
    for (tag, name) in [
        ("<select>", "select"),
        ("<textarea>", "textarea"),
        ("<div tabindex='0'>", "div"),
        ("<div contenteditable='TRUE'>", "div"),
    ] {
        assert!(source_tag_matches_selector(tag, name, FOCUS));
    }
    for tag in [
        "<div tabindex='-1'>",
        "<div contenteditable='false'>",
        "<div role='other'>",
    ] {
        assert!(!source_tag_matches_selector(tag, "div", FOCUS));
    }
    assert!(source_tag_matches_selector(
        "<div role='main'>",
        "div",
        "main, [role='main']"
    ));
    assert!(!source_tag_matches_selector(
        "<div role='other'>",
        "div",
        "main, [role='main']"
    ));
    assert!(!source_tag_matches_selector("<div>", "div", "unsupported"));
}

#[test]
fn bounded_interactive_image_and_focus_samples_preserve_total_finding_counts() {
    let source = format!(
        "<main aria-hidden='true'>{}</main>",
        "<button></button><img>".repeat(100)
    );
    let document = Html::parse_document(&source);
    let mut messages = Vec::new();
    let mut finding =
        |_: &str, _: &str, message: String, _: String, _: &str| messages.push(message);
    assert_eq!(
        interactive_elements(&document, &source, &HashSet::new(), &mut finding).len(),
        50
    );
    assert_eq!(focus_elements(&document, &source, &mut finding).len(), 50);
    assert_eq!(image_elements(&document, &source, &mut finding).len(), 50);
    assert_eq!(messages.len(), 3);
    assert!(messages.iter().all(|message| message.contains("100")));
}
