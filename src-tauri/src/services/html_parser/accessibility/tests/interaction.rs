use super::*;

#[test]
fn focus_evidence_ignores_disabled_inert_and_hidden_but_reports_aria_only_hiding() {
    let source = "<main aria-hidden='true'><button>A</button><button disabled>B</button><button aria-disabled='true'>C</button><div inert><button>D</button></div><button hidden>E</button></main>";
    let doc = Html::parse_document(source);
    let mut codes = Vec::new();
    let elements = focus_elements(&doc, source, &mut |code, _, _, _, _| {
        codes.push(code.to_string())
    });
    assert_eq!(codes, vec!["accessibility-focusable-aria-hidden"]);
    assert_eq!(elements.len(), 1);
    assert!(elements[0].html_snippet.contains(">"));
    assert_eq!(elements[0].dom_position, 1);
}

#[test]
fn interaction_names_accept_text_image_and_aria_labels_and_distinguish_decorative_alt() {
    let source = "<button id='empty'></button><a href='/'>Name</a><button aria-label='Go'></button><button><img alt='Go'></button><img id='missing'><img alt=''>";
    let doc = Html::parse_document(source);
    let mut codes = Vec::new();
    let unnamed = interactive_elements(&doc, source, &HashSet::new(), &mut |code, _, _, _, _| {
        codes.push(code.to_string())
    });
    assert_eq!(codes, vec!["accessibility-interactive-name-missing"]);
    assert_eq!(unnamed.len(), 1);
    assert!(unnamed[0].html_snippet.contains("id=\"empty\""));
    codes.clear();
    let images = image_elements(&doc, source, &mut |code, _, _, _, _| {
        codes.push(code.to_string())
    });
    assert_eq!(codes, vec!["accessibility-image-alt-missing"]);
    assert_eq!(images.len(), 1);
    assert!(images[0].html_snippet.contains("id=\"missing\""));
    let mut findings = vec![AccessibilityFinding {
        code: "target".into(),
        severity: "warning".into(),
        message: "message".into(),
        evidence: "evidence".into(),
        recommendation: "fix".into(),
        elements: vec![],
    }];
    attach_elements(&mut findings, "other", unnamed);
    assert!(findings[0].elements.is_empty());
    attach_elements(&mut findings, "target", images);
    assert_eq!(findings.len(), 1);
    assert!(findings[0].elements[0]
        .html_snippet
        .contains("id=\"missing\""));
}
