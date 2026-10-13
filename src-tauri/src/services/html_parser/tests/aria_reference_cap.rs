use crate::services::html_parser::accessibility::extract_accessibility;
use scraper::Html;

#[test]
fn unresolved_aria_references_are_reported_with_a_bounded_evidence_list() {
    let refs = (0..15)
        .map(|n| format!("missing{n}"))
        .collect::<Vec<_>>()
        .join(" ");
    let html = format!(
        r#"<html lang="en"><body><main><div aria-describedby="{refs}">x</div></main></body></html>"#
    );
    let audit = extract_accessibility(&Html::parse_document(&html), &html);
    let finding = audit
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-aria-reference-unresolved")
        .expect("unresolved reference finding");
    assert!(finding.evidence.contains("missing0"));
    assert!(!finding.evidence.contains("missing14"));
}
