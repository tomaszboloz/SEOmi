use super::audit_amp;

#[test]
fn leaves_regular_page_without_amp_signals_unclassified() {
    let report = audit_amp(
        "<html><head><title>Page</title></head><body>Text</body></html>",
        "https://example.test/",
    );
    assert!(!report.detected);
    assert!(!report.is_amp_document);
    assert!(report.amphtml_urls.is_empty());
    assert!(report.findings.is_empty(), "unexpected findings: {:?}", report.findings);
    assert_eq!(report.coverage, "partial-local-rules");
}

#[test]
fn resolves_amphtml_and_canonical_targets_without_fetching_them() {
    let report = audit_amp(
        "<html><head><link rel='canonical' href='/article'><link rel='amphtml' href='/article/amp'></head><body></body></html>",
        "https://example.test/article",
    );
    assert!(report.detected);
    assert!(!report.is_amp_document);
    assert_eq!(report.amphtml_urls, vec!["https://example.test/article/amp"]);
    assert_eq!(report.canonical_url.as_deref(), Some("https://example.test/article"));
    assert!(report.unchecked.iter().any(|item| item.contains("Network status")));
}

#[test]
fn reports_required_amp_document_markers_and_non_allowlisted_scripts() {
    let report = audit_amp(
        "<html amp><head><script src='https://example.test/app.js'></script></head><body></body></html>",
        "https://example.test/article/amp",
    );
    assert!(report.is_amp_document);
    let codes = report.findings.iter().map(|item| item.code.as_str()).collect::<Vec<_>>();
    for expected in [
        "amp-canonical-missing",
        "amp-charset-missing",
        "amp-viewport-missing",
        "amp-runtime-missing",
        "amp-boilerplate-missing",
        "amp-noscript-boilerplate-missing",
        "amp-script-not-allowlisted",
    ] {
        assert!(codes.contains(&expected), "missing finding {expected}");
    }
    assert!(report.findings.iter().all(|item| {
        !item.message.is_empty() && !item.evidence.is_empty() && !item.recommendation.is_empty()
    }));
}

#[test]
fn validates_amp_canonical_declarations_without_fetching_the_target() {
    let report = audit_amp(
        "<html amp><head><link rel='canonical'><link rel='canonical' href='javascript:alert(1)'></head><body></body></html>",
        "https://example.test/article/amp",
    );
    let codes = report.findings.iter().map(|item| item.code.as_str()).collect::<Vec<_>>();
    assert!(codes.contains(&"amp-canonical-multiple"));
    assert!(codes.contains(&"amp-canonical-target-invalid"));
    assert_eq!(report.canonical_url.as_deref(), Some("javascript:alert(1)"));
    assert!(report.findings.iter().all(|item| {
        !item.message.is_empty() && !item.evidence.is_empty() && !item.recommendation.is_empty()
    }));
}

#[test]
fn deduplicates_and_bounds_amphtml_targets() {
    let report = audit_amp(
        "<html><head><link rel='amphtml' href='/amp'><link rel='alternate amphtml' href='/amp'><link rel='amphtml' href='/other'></head><body></body></html>",
        "https://example.test/",
    );
    assert_eq!(report.amphtml_urls, vec!["https://example.test/amp", "https://example.test/other"]);
    assert!(report.findings.iter().any(|item| item.code == "amphtml-multiple-targets"));
}
