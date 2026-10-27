use super::parse_links;
use url::Url;

#[test]
fn contract_links_host_boundaries_relative_urls_and_safe_blank_rel_values() {
    let (analysis, issues) = parse_links(
        r#"<a href="../next">Next</a>
        <a href="//sub.example.com/page" rel="NOFOLLOW sponsored">Subdomain</a>
        <a href="https://notexample.com/page" target="_blank" rel="noreferrer">Other</a>
        <a href="https://example.com.evil.test/page" target="_blank" rel="NOOPENER">Lookalike</a>
        <a href="https://other.test/page" target="_blank" rel="nofollow">Unsafe</a>"#,
        &Url::parse("https://example.com/articles/page").unwrap(),
    );
    assert_eq!(analysis.total_links, 5);
    assert_eq!(analysis.internal_links, 2);
    assert_eq!(analysis.external_links, 3);
    assert_eq!(analysis.nofollow_links, 2);
    assert_eq!(analysis.links[0].href, "https://example.com/next");
    assert_eq!(analysis.links[1].href, "https://sub.example.com/page");
    assert!(!analysis.links[2].is_internal && !analysis.links[3].is_internal);
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].code.as_deref(), Some("links_target_blank"));
    assert_eq!(issues[0].params.as_ref().unwrap()["count"], "1");
}

#[test]
fn contract_links_empty_documents_have_zero_counts_and_no_findings() {
    let (analysis, issues) = parse_links(
        r##"<a>No href</a><a href=" ">Empty</a><a href="#main">Fragment</a>"##,
        &Url::parse("https://example.test").unwrap(),
    );
    assert_eq!(analysis.total_links, 0);
    assert_eq!(analysis.internal_links, 0);
    assert_eq!(analysis.external_links, 0);
    assert_eq!(analysis.nofollow_links, 0);
    assert!(analysis.links.is_empty() && issues.is_empty());
}

#[test]
fn parses_link_facts_and_security_findings_from_real_html() {
    let html = r##"
        <a href="">empty</a><a href="#section">fragment</a>
        <a href="javascript:void(0)">script</a>
        <a href="/internal" target="_self">Internal</a>
        <a href="https://sub.example.com/page" rel="NOFOLLOW">Subdomain</a>
        <a href="mailto:test@example.com">Email</a>
        <a href="https://other.test" target="_blank">Unsafe</a>
        <a href="http://other.test/insecure" target="_blank" rel="noopener">HTTP</a>
        <a href="http://[::1">Malformed</a>
    "##;
    let (analysis, issues) = parse_links(html, &Url::parse("https://example.com/root").unwrap());

    assert_eq!(analysis.total_links, 6);
    assert_eq!(analysis.internal_links, 4);
    assert_eq!(analysis.external_links, 2);
    assert_eq!(analysis.nofollow_links, 1);
    assert!(analysis
        .links
        .iter()
        .any(|link| link.href.ends_with("/internal") && link.is_internal));
    assert!(analysis
        .links
        .iter()
        .any(|link| link.is_insecure && link.href.starts_with("http://")));
    assert_eq!(issues.len(), 2);
    assert_eq!(issues[0].code.as_deref(), Some("links_target_blank"));
    assert_eq!(issues[0].params.as_ref().unwrap()["count"], "1");
    assert_eq!(issues[1].code.as_deref(), Some("links_insecure"));
    assert_eq!(issues[1].params.as_ref().unwrap()["count"], "2");
}

#[test]
fn non_https_pages_do_not_mark_http_navigation_as_insecure() {
    let (analysis, issues) = parse_links(
        r#"<a href="http://example.com/next">Next</a>"#,
        &Url::parse("http://example.com").unwrap(),
    );
    assert_eq!(analysis.external_links, 0);
    assert!(!analysis.links[0].is_insecure);
    assert!(issues.is_empty());
}
