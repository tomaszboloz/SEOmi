use super::*;

#[test]
fn refresh_declarations_resolve_http_targets_and_preserve_invalid_evidence() {
    let base = url::Url::parse("https://example.com/articles/page").unwrap();
    let meta = parse_client_redirect("meta-refresh", "0; URL='/next'", &base);
    assert_eq!(meta.source, "meta-refresh");
    assert_eq!(meta.delay_seconds, Some(0.0));
    assert_eq!(meta.target_url.as_deref(), Some("https://example.com/next"));

    let header = parse_client_redirect("http-refresh", "5.5; url=\"../new\"", &base);
    assert_eq!(header.delay_seconds, Some(5.5));
    assert_eq!(
        header.target_url.as_deref(),
        Some("https://example.com/new")
    );

    let invalid = parse_client_redirect("http-refresh", "-1; url=javascript:alert(1)", &base);
    assert_eq!(invalid.delay_seconds, None);
    assert_eq!(invalid.target_url, None);
    assert_eq!(invalid.declaration, "-1; url=javascript:alert(1)");
}

#[test]
fn javascript_redirects_capture_literal_targets_without_executing_scripts() {
    let document = Html::parse_document(
        r#"
              <script>window.location.href = '/next';</script>
              <script>location.replace("https://example.com/final");</script>
              <script type="module">location.assign('/module');</script>
              <script>self.location = `/template`; top.location.replace(`https://example.com/template-final`);</script>
              <script type="application/ld+json">{"location":"/not-a-redirect"}</script>
              <script>location.assign(destination); location.href = protocol + '/dynamic';</script>
              <button onclick="location.href='/clicked'">Go</button>
            "#,
    );
    let base = url::Url::parse("https://example.com/articles/page").unwrap();

    let redirects = extract_javascript_redirects(&document, &base);

    assert_eq!(redirects.len(), 6);
    assert_eq!(
        redirects
            .iter()
            .filter(|item| item.source == "javascript")
            .count(),
        5
    );
    assert_eq!(
        redirects
            .iter()
            .filter(|item| item.source == "javascript-inline")
            .count(),
        1
    );
    assert_eq!(
        redirects[0].target_url.as_deref(),
        Some("https://example.com/next")
    );
    assert_eq!(
        redirects[1].target_url.as_deref(),
        Some("https://example.com/final")
    );
    assert_eq!(
        redirects[2].target_url.as_deref(),
        Some("https://example.com/module")
    );
    assert_eq!(
        redirects[3].target_url.as_deref(),
        Some("https://example.com/template")
    );
    assert_eq!(
        redirects[4].target_url.as_deref(),
        Some("https://example.com/template-final")
    );
    assert_eq!(
        redirects[5].target_url.as_deref(),
        Some("https://example.com/clicked")
    );
    assert!(redirects[0].declaration.contains("location.href"));
    assert!(redirects[1].declaration.contains("location.replace"));
}

#[test]
fn pagination_extraction_preserves_relations_invalid_declarations_and_query_changes() {
    let document = Html::parse_document(
        r#"<link rel="next" href="?page=2&amp;lang=pl"><a rel="prev" href="?page=0&amp;lang=pl">previous</a><link rel="next"><a rel="prev" href="javascript:alert(1)">broken</a>"#,
    );
    let base = url::Url::parse("https://example.com/articles?page=1&lang=pl").unwrap();
    let (links, declaration_count, invalid_count) = crawl_pagination_links(&document, &base);

    assert_eq!(declaration_count, 4);
    assert_eq!(invalid_count, 2);
    assert_eq!(links.len(), 2);
    assert_eq!(links[0].relation, "next");
    assert_eq!(
        links[0].target_url,
        "https://example.com/articles?page=2&lang=pl"
    );
    assert_eq!(links[0].query_parameter_changes, vec!["page: 1 → 2"]);
    assert_eq!(links[1].relation, "prev");
    assert_eq!(links[1].query_parameter_changes, vec!["page: 1 → 0"]);
}

#[test]
fn pagination_query_changes_preserve_duplicate_parameter_values() {
    let source = url::Url::parse("https://example.com/items?tag=one&tag=two&sort=asc").unwrap();
    let target = url::Url::parse("https://example.com/items?tag=one&tag=three&sort=asc").unwrap();

    assert_eq!(
        pagination_query_changes(&source, &target),
        vec!["tag: one, two → one, three"]
    );
    let empty_target = url::Url::parse("https://example.com/items").unwrap();
    assert_eq!(
        pagination_query_changes(&source, &empty_target),
        vec!["sort: asc → ∅", "tag: one, two → ∅"]
    );
}

#[test]
fn pagination_reciprocity_uses_the_opposite_relation() {
    assert_eq!(opposite_pagination_relation("next"), Some("prev"));
    assert_eq!(opposite_pagination_relation("PREV"), Some("next"));
    assert_eq!(opposite_pagination_relation("alternate"), None);
}

#[test]
fn pagination_canonical_alignment_is_explicit_and_uses_current_page_canonical_signal() {
    assert_eq!(
        pagination_canonical_alignment("self").as_deref(),
        Some("self-canonical")
    );
    assert_eq!(
        pagination_canonical_alignment("same-host-other-url").as_deref(),
        Some("canonical-points-elsewhere")
    );
    assert_eq!(
        pagination_canonical_alignment("missing").as_deref(),
        Some("missing-canonical")
    );
    assert_eq!(pagination_canonical_alignment("unavailable"), None);
}
