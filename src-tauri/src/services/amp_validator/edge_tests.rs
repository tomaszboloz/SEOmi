use super::{audit_amp, components::extension_matches};

fn codes(head: &str, body: &str) -> Vec<String> {
    audit_amp(
        &format!("<html amp><head>{head}</head><body>{body}</body></html>"),
        "https://example.test/",
    )
    .findings
    .into_iter()
    .map(|f| f.code)
    .collect()
}

#[test]
fn extension_matching_checks_origin_component_version_and_suffix() {
    for src in [
        "https://cdn.ampproject.org/v0/amp-accordion.js",
        " https://cdn.ampproject.org/v0/amp-accordion-0.1.js ",
        "https://cdn.ampproject.org/v0/amp-accordion-1.0.js/",
    ] {
        assert!(extension_matches(src, "amp-accordion"));
    }
    for src in [
        "http://cdn.ampproject.org/v0/amp-accordion-0.1.js",
        "https://other.example/v0/amp-accordion-0.1.js",
        "https://cdn.ampproject.org/v0/amp-tabs-0.1.js",
        "https://cdn.ampproject.org/v0/amp-accordion-0.1.css",
        "https://cdn.ampproject.org/v0/amp-accordion-0..1.js",
        "https://cdn.ampproject.org/v0/amp-accordion-bad.js",
        "https://cdn.ampproject.org/v0/amp-accordion-.js",
    ] {
        assert!(!extension_matches(src, "amp-accordion"), "{src}");
    }
}

#[test]
fn alternates_reject_empty_and_non_http_targets_and_retain_only_32() {
    let links = "<link rel='amphtml' href=''><link rel='amphtml' href='javascript:bad'>";
    let report = audit_amp(links, "not a URL");
    assert!(report
        .findings
        .iter()
        .any(|f| f.code == "amphtml-href-empty"));
    assert!(report
        .findings
        .iter()
        .any(|f| f.code == "amphtml-target-invalid"));
    let links = (0..40)
        .map(|n| format!("<link rel='amphtml' href='/amp/{n}'>"))
        .collect::<String>();
    let report = audit_amp(&links, "https://example.test/");
    assert_eq!(report.amphtml_urls.len(), 32);
    assert!(report
        .findings
        .iter()
        .any(|f| f.code == "amphtml-target-limit"));
}

#[test]
fn empty_canonical_and_late_charset_and_non_async_runtime_have_findings() {
    let head = format!("<title>{}</title><meta charset='UTF-8'><link rel='canonical' href=' '><script src='https://cdn.ampproject.org/v0.js'></script>", "x".repeat(1100));
    let findings = codes(&head, "");
    for code in [
        "amp-canonical-href-empty",
        "amp-charset-position",
        "amp-runtime-async-missing",
    ] {
        assert!(findings.iter().any(|f| f == code));
    }
    let report = audit_amp(
        "<html amp><link rel='canonical' href='/article'></html>",
        "not a URL",
    );
    assert_eq!(report.canonical_url.as_deref(), Some("/article"));
    assert!(report
        .findings
        .iter()
        .any(|f| f.code == "amp-canonical-target-invalid"));
}

#[test]
fn css_budget_counts_utf8_bytes_at_the_boundary() {
    for (count, exceeded) in [(37500, false), (37501, true)] {
        let head = format!("<style amp-custom>{}</style>", "ż".repeat(count));
        assert_eq!(
            codes(&head, "")
                .iter()
                .any(|c| c == "amp-custom-css-over-budget"),
            exceeded
        );
    }
}

#[test]
fn element_recommendations_and_global_findings_cap_are_preserved() {
    let report = audit_amp("<html amp><body><iframe></iframe><video></video><audio></audio><object></object></body></html>", "https://example.test/");
    for recommended in ["amp-iframe", "amp-video", "amp-audio", "AMP-supported"] {
        assert!(report
            .findings
            .iter()
            .any(|f| f.recommendation.contains(recommended)));
    }
    let report = audit_amp(
        &format!(
            "<html amp><body>{}</body></html>",
            "<img onclick='private()'>".repeat(80)
        ),
        "https://example.test/",
    );
    assert_eq!(report.findings.len(), 100);
    assert!(report
        .findings
        .iter()
        .all(|f| !f.evidence.contains("private()")));
}

#[test]
fn component_extraction_deduplicates_and_caps_names() {
    let components = (0..70)
        .map(|n| format!("<amp-test-{n}></amp-test-{n}>"))
        .collect::<String>();
    let report = audit_amp(
        &format!("<html amp><body><amp-test-0></amp-test-0>{components}</body></html>"),
        "https://example.test/",
    );
    assert_eq!(
        report
            .findings
            .iter()
            .filter(|f| f.code == "amp-component-script-missing")
            .count(),
        64
    );
}

#[test]
fn json_data_scripts_are_allowed_and_missing_noscript_still_reports_a_finding() {
    let head = "<script type='APPLICATION/LD+JSON'>{}</script><script type='application/json'>{}</script><noscript>no style</noscript><noscript>not boilerplate";
    let findings = codes(head, "");
    assert!(!findings.iter().any(|c| c == "amp-script-not-allowlisted"));
    assert!(findings
        .iter()
        .any(|c| c == "amp-noscript-boilerplate-missing"));
}
