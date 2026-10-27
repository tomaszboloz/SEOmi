use super::*;

#[test]
fn ignores_dynamic_subtrees_and_keeps_structural_difference() {
    let a = Html::parse_document("<html><body><main><article><h1>T</h1><script>x()</script><p>P</p></article></main></body></html>");
    let b = Html::parse_document(
        "<html><body><main><section><h1>T</h1><p>P</p></section></main></body></html>",
    );
    assert!(!signature(&a).unwrap().contains("script"));
    assert_ne!(signature(&a), signature(&b));
}

#[test]
fn captures_declared_values_and_omits_unavailable_evidence() {
    let doc = Html::parse_document("<html><head><meta name='template:variable' content='krakow'><meta name='tas:subtopic' content='local'></head><body><p>P</p></body></html>");
    let attached = attach(CrawledPageFocus::default(), &doc, true);
    assert_eq!(
        attached.template_injected_variables.as_deref(),
        Some(["krakow".to_string()].as_slice())
    );
    assert_eq!(attached.tas_subtopic_id.as_deref(), Some("local"));
    let unavailable = attach(CrawledPageFocus::default(), &doc, false);
    assert!(unavailable.template_dom_signature.is_none());
    assert!(signature(&Html::parse_fragment("<main>P</main>")).is_none());
}
