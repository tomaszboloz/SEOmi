use super::audit_amp;

#[test]
fn builtin_components_do_not_require_extension_scripts() {
    let report = audit_amp("<html amp><body><amp-img></amp-img><amp-layout></amp-layout><amp-pixel></amp-pixel></body></html>", "https://example.test/");
    assert!(!report
        .findings
        .iter()
        .any(|f| f.code == "amp-component-script-missing"));
}

#[test]
fn versioned_component_script_is_recognized() {
    let report = audit_amp("<html amp><head><script async custom-element='amp-accordion' src='https://cdn.ampproject.org/v0/amp-accordion-0.1.js'></script></head><body><amp-accordion></amp-accordion></body></html>", "https://example.test/");
    assert!(!report
        .findings
        .iter()
        .any(|f| f.code == "amp-component-script-missing"));
}

#[test]
fn forbidden_element_findings_obey_the_advertised_64_instance_limit() {
    let report = audit_amp(
        &format!("<html amp><body>{}</body></html>", "<img>".repeat(65)),
        "https://example.test/",
    );
    assert_eq!(
        report
            .findings
            .iter()
            .filter(|f| f.code == "amp-element-not-allowed")
            .count(),
        64
    );
    assert!(report
        .findings
        .iter()
        .any(|f| f.code == "amp-component-limit"));
}
