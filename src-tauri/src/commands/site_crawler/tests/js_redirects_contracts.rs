use super::*;

fn redirects(markup: &str) -> Vec<CrawledClientRedirect> {
    let document = Html::parse_document(markup);
    let base = url::Url::parse("https://example.com/section/page").unwrap();
    extract_javascript_redirects(&document, &base)
}

#[test]
fn captures_assignments_calls_templates_and_allowed_script_types() {
    let result = redirects(
        r#"
        <script>window.location = '/assignment'; document.location.href = "https://example.test/call";</script>
        <script type="module">self.location.replace('/module');</script>
        <script type="text/javascript">top.location.assign(`https://example.test/template`); window.location = `/template-assignment`;</script>
        <script type="application/ld+json">{"location":"/ignored"}</script>
        <button onclick="location.href='/event'">go</button>
    "#,
    );
    assert_eq!(result.len(), 6);
    assert_eq!(
        result
            .iter()
            .filter(|item| item.source == "javascript")
            .count(),
        5
    );
    assert_eq!(
        result
            .iter()
            .filter(|item| item.source == "javascript-inline")
            .count(),
        1
    );
    assert_eq!(
        result[0].target_url.as_deref(),
        Some("https://example.com/assignment")
    );
    assert_eq!(
        result[1].target_url.as_deref(),
        Some("https://example.test/call")
    );
    assert_eq!(
        result[2].target_url.as_deref(),
        Some("https://example.com/module")
    );
    assert_eq!(
        result[3].target_url.as_deref(),
        Some("https://example.com/template-assignment")
    );
    assert_eq!(
        result[4].target_url.as_deref(),
        Some("https://example.test/template")
    );
    assert_eq!(
        result[5].target_url.as_deref(),
        Some("https://example.com/event")
    );
}

#[test]
fn preserves_invalid_schemes_and_deduplicates_same_evidence() {
    let result = redirects(
        r#"
        <script>location.href='/same'; location.href='/same'; location.assign('javascript:alert(1)'); location.replace('mailto:x@y.test');</script>
        <script type="application/json">location.href='/ignored';</script>
    "#,
    );
    assert_eq!(result.len(), 3);
    assert_eq!(
        result[0].target_url.as_deref(),
        Some("https://example.com/same")
    );
    assert_eq!(result[1].target_url, None);
    assert_eq!(result[2].target_url, None);
}

#[test]
fn bounds_redirect_evidence_to_thirty_two_items() {
    let scripts = (0..40)
        .map(|index| format!("<script>location.assign('/item-{index}')</script>"))
        .collect::<String>();
    let result = redirects(&scripts);
    assert_eq!(result.len(), 32);
    assert_eq!(
        result.last().and_then(|item| item.target_url.as_deref()),
        Some("https://example.com/item-31")
    );
    assert!(result.iter().all(|item| item.declaration.len() <= 2048));
}
