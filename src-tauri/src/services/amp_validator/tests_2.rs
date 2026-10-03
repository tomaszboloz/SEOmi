use super::audit_amp;

#[test]
fn recognizes_common_amp_document_requirements_without_claiming_full_validity() {
    let report = audit_amp(
        r#"<!doctype html><html amp><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1"><link rel="canonical" href="https://example.test/article"><script async src="https://cdn.ampproject.org/v0.js"></script><style amp-boilerplate>body{visibility:hidden}</style><noscript><style amp-boilerplate>body{visibility:visible}</style></noscript></head><body><h1>AMP page</h1></body></html>"#,
        "https://example.test/article/amp",
    );
    assert!(report.is_amp_document);
    assert!(report.findings.is_empty(), "unexpected findings: {:?}", report.findings);
    assert_eq!(report.canonical_url.as_deref(), Some("https://example.test/article"));
    assert_eq!(report.coverage, "partial-local-rules");
    assert!(!report.unchecked.is_empty());
}

#[test]
fn reports_inline_scripts_forbidden_elements_and_missing_component_extensions() {
    let report = audit_amp(
        r#"<html amp><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://example.test/article"><script async src="https://cdn.ampproject.org/v0.js"></script><style amp-boilerplate>body{visibility:hidden}</style><noscript><style amp-boilerplate>body{visibility:visible}</style></noscript></head><body><img src="photo.jpg" onclick="track()"><amp-img src="photo.jpg"></amp-img><script>window.bad=true</script></body></html>"#,
        "https://example.test/article/amp",
    );
    let codes = report.findings.iter().map(|item| item.code.as_str()).collect::<Vec<_>>();
    assert!(codes.contains(&"amp-element-not-allowed"));
    assert!(codes.contains(&"amp-inline-event-handler"));
    assert!(codes.contains(&"amp-component-script-missing"));
    assert!(codes.contains(&"amp-script-not-allowlisted"));
}

#[test]
fn validates_amp_custom_css_cardinality_and_imports() {
    let report = audit_amp(
        r#"<html amp><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://example.test/article"><script async src="https://cdn.ampproject.org/v0.js"></script><style amp-boilerplate>body{visibility:hidden}</style><noscript><style amp-boilerplate>body{visibility:visible}</style></noscript><style amp-custom>@import url('theme.css');</style><style amp-custom>body{color:red}</style></head><body></body></html>"#,
        "https://example.test/article/amp",
    );
    let codes = report.findings.iter().map(|item| item.code.as_str()).collect::<Vec<_>>();
    assert!(codes.contains(&"amp-custom-css-multiple"));
    assert!(codes.contains(&"amp-custom-css-import"));
}

#[test]
fn accepts_amp_component_when_extension_is_loaded() {
    let report = audit_amp(
        r#"<html amp><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://example.test/article"><script async src="https://cdn.ampproject.org/v0.js"></script><script async custom-element="amp-img" src="https://cdn.ampproject.org/v0/amp-img.js"></script><style amp-boilerplate>body{visibility:hidden}</style><noscript><style amp-boilerplate>body{visibility:visible}</style></noscript></head><body><amp-img src="photo.jpg"></amp-img></body></html>"#,
        "https://example.test/article/amp",
    );
    assert!(!report.findings.iter().any(|item| item.code == "amp-component-script-missing"));
}
