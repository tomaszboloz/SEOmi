use super::*;

#[test]
fn full_finding_list_does_not_gain_an_extra_truncation_notice() {
    let broken = r#"<script type="application/ld+json">{</script>"#.repeat(100);
    let microdata = "<div itemscope></div>".repeat(150);
    let html = format!("<html><head>{broken}</head><body>{microdata}</body></html>");
    let (_, errors, findings, _, truncated) = inspect_page_schema(&Html::parse_document(&html));
    assert_eq!(errors, 100);
    assert!(truncated);
    assert_eq!(findings.len(), MAX_SCHEMA_FINDINGS_PER_PAGE);
    assert!(!findings
        .iter()
        .any(|item| item.finding.code == "schema-validation-truncated"));
}
