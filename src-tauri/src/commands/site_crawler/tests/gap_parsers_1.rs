use super::*;

#[test]
fn hreflang_accepts_numeric_regions_long_variants_and_rejects_oversized_private_use() {
    for valid in [
        "en-123",
        "es-419",
        "ca-valencia",
        "de-1996",
        "sl-rozaj-biske",
    ] {
        assert!(is_valid_hreflang_code(valid), "{valid}");
    }
    assert!(!is_valid_hreflang_code("en-x-abcdefghi"));
    assert!(!is_valid_hreflang_code("en-a-abcdefghi"));
    assert!(!is_valid_hreflang_code("zh-ab1-cmn"));
    assert!(!is_valid_hreflang_code("de-1996-1996"));
}

#[test]
fn robots_parser_skips_non_matching_groups_and_merges_adjacent_user_agents() {
    let content = "User-agent: otherbot\nDisallow: /other\nUser-agent: seomibot\nDisallow: /own\n";
    let rules = parse_robots_rules(content, "SEOmiBot/1.0");
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].path, "/own");

    let stacked = "User-agent: seomibot\nUser-agent: seomibot\nDisallow: /stacked\n";
    let rules = parse_robots_rules(stacked, "seomibot");
    assert_eq!(rules.len(), 1);
}

#[test]
fn robots_agent_matrix_drops_blank_and_duplicate_identities() {
    let blank = build_robots_agent_matrix("User-agent: *\nDisallow: /a\n", "   ");
    assert_eq!(blank.len(), ROBOTS_AGENT_MATRIX.len());
    let duplicate = build_robots_agent_matrix("User-agent: *\nDisallow: /a\n", "googlebot");
    assert_eq!(duplicate.len(), ROBOTS_AGENT_MATRIX.len() + 1);
    assert_eq!(duplicate[0].user_agent, "googlebot");
    assert!(
        duplicate
            .iter()
            .filter(|a| a.user_agent.eq_ignore_ascii_case("googlebot"))
            .count()
            == 1
    );
}

#[test]
fn javascript_redirects_deduplicate_repeated_template_literals() {
    let document = Html::parse_document(
        "<script>location = `/a`; location = `/a`; location.replace(`/b`); location.replace(`/b`);</script>",
    );
    let base = url::Url::parse("https://example.test/").unwrap();
    let redirects = extract_javascript_redirects(&document, &base);
    assert_eq!(redirects.len(), 2);
}

#[test]
fn style_without_a_colon_is_ignored_when_detecting_hidden_content() {
    assert!(!semantic_style_hides("hidden; color red"));
    assert!(semantic_style_hides("hidden; display: none"));
}

#[test]
fn semantic_terms_ignore_text_nested_in_svg() {
    let document = Html::parse_document(
        "<body><main><svg><text>zebra zebra zebra</text></svg><p>planet orbit planet orbit</p></main></body>",
    );
    let terms = extract_semantic_terms(&document, Some("en"));
    assert!(!terms.iter().any(|t| t.contains("zebra")));
}

#[test]
fn complexity_label_is_complex_for_long_sentences_of_long_words() {
    let text = "supercalifragilistic ".repeat(60);
    let document = Html::parse_document(&format!("<main><p>{text}</p></main>"));
    let metrics = content_metrics(&document, 5000, Some("en"));
    assert_eq!(metrics.complexity_label.as_deref(), Some("complex"));
}

#[test]
fn indexability_verdict_covers_missing_status_outside_browser_mode() {
    let v = build_indexability_verdict(0, "http", false, false, false, false, false);
    assert_eq!(v.status, "uncertain");
    assert!(!v.reasons.iter().any(|r| r == "http_status_unavailable"));
    let v = build_indexability_verdict(200, "browser-rendered", false, false, false, false, false);
    assert!(!v.reasons.iter().any(|r| r == "http_status_unavailable"));
    let tokens = robots_directive_tokens(Some("NoIndex!, -, (nofollow); googlebot: none"));
    assert!(tokens.contains(&"noindex".to_string()) && tokens.contains(&"nofollow".to_string()));
}
