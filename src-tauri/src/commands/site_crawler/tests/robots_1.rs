use super::*;

#[test]
fn robots_rules_prefer_the_longest_matching_rule() {
    let rules = parse_robots_rules(
        "User-agent: seomi\nDisallow: /private\nAllow: /private/public\n",
        "seomi",
    );
    assert!(!robots_allows(
        &url::Url::parse("https://example.com/private/one").unwrap(),
        &rules
    ));
    assert!(robots_allows(
        &url::Url::parse("https://example.com/private/public/page").unwrap(),
        &rules
    ));
}

#[test]
fn robots_decision_combines_meta_and_header_tokens_with_sources() {
    let decision = build_robots_decision(Some("index, nofollow"), Some("googlebot: noindex"), true);

    assert_eq!(decision.indexability, "noindex");
    assert_eq!(decision.link_following, "nofollow");
    assert_eq!(decision.directives, vec!["index", "nofollow", "noindex"]);
    assert_eq!(decision.sources, vec!["meta robots", "X-Robots-Tag"]);
    assert!(decision.response_headers_available);
}

#[test]
fn indexability_verdict_is_typed_and_explains_each_blocking_signal() {
    let blocked = build_indexability_verdict(200, "http", true, false, true, true, false);
    assert_eq!(blocked.status, "blocked");
    assert_eq!(
        blocked.reasons,
        vec![
            "robots_noindex",
            "canonical_points_elsewhere",
            "robots_nofollow"
        ]
    );

    let rendered =
        build_indexability_verdict(200, "browser-rendered", false, false, false, false, false);
    assert_eq!(rendered.status, "uncertain");
    assert_eq!(rendered.reasons, vec!["x_robots_header_unavailable"]);

    let redirect = build_indexability_verdict(301, "http", false, false, false, false, false);
    assert_eq!(redirect.status, "uncertain");
    assert_eq!(redirect.reasons, vec!["redirect_response"]);
}

#[test]
fn robots_rules_allow_equal_length_ties() {
    let rules = parse_robots_rules(
        "User-agent: seomi\nDisallow: /private\nAllow: /private\n",
        "seomi",
    );
    let url = url::Url::parse("https://example.com/private").unwrap();

    assert!(robots_allows(&url, &rules));
    assert!(robots_deciding_rule(&url, &rules).unwrap().allow);
}

#[test]
fn robots_rules_match_escaped_and_human_readable_paths() {
    let rules = parse_robots_rules(
        "User-agent: seomi\nDisallow: /private%20area/$\nDisallow: /search?q=summer%20sale\n",
        "seomi",
    );
    let escaped_path = url::Url::parse("https://example.com/private%20area/").unwrap();
    let readable_path = url::Url::parse("https://example.com/private area/").unwrap();
    let escaped_query = url::Url::parse("https://example.com/search?q=summer%20sale").unwrap();

    assert!(!robots_allows(&escaped_path, &rules));
    assert!(!robots_allows(&readable_path, &rules));
    assert!(!robots_allows(&escaped_query, &rules));
}

#[test]
fn robots_path_matching_keeps_invalid_percent_escapes_literal() {
    let rules = parse_robots_rules("User-agent: *\nDisallow: /bad%ZZ\n", "seomi");
    let matching = url::Url::parse("https://example.com/bad%ZZ").unwrap();
    let different = url::Url::parse("https://example.com/bad-value").unwrap();

    assert!(!robots_allows(&matching, &rules));
    assert!(robots_allows(&different, &rules));
}

#[test]
fn robots_specific_agent_group_overrides_the_wildcard_group() {
    let rules = parse_robots_rules(
        "User-agent: *\nDisallow: /\nUser-agent: SEOmiDesktopBot\nAllow: /public\n",
        "SEOmiDesktopBot/1.0",
    );

    assert_eq!(rules.len(), 1);
    assert!(robots_allows(
        &url::Url::parse("https://example.com/private").unwrap(),
        &rules
    ));
    assert!(robots_allows(
        &url::Url::parse("https://example.com/public").unwrap(),
        &rules
    ));
}

#[test]
fn robots_agent_matrix_keeps_specific_groups_and_wildcard_fallbacks_separate() {
    let matrix = build_robots_agent_matrix(
        "User-agent: *\nDisallow: /\nUser-agent: GPTBot\nAllow: /ai\nCrawl-delay: 2\n",
        "SEOmiDesktopBot/1.0",
    );
    let desktop = matrix
        .iter()
        .find(|entry| entry.user_agent == "SEOmiDesktopBot/1.0")
        .expect("effective user-agent is included");
    assert!(!desktop.specific_group);
    assert_eq!(desktop.applicable_rules[0].directive, "disallow");

    let gpt = matrix
        .iter()
        .find(|entry| entry.user_agent == "GPTBot")
        .expect("GPTBot is included");
    assert!(gpt.specific_group);
    assert_eq!(gpt.applicable_rules[0].directive, "allow");
    assert_eq!(gpt.crawl_delay_ms, Some(2_000));
}

#[test]
fn robots_rules_support_wildcards_and_end_anchors() {
    let rules = parse_robots_rules(
        "User-agent: *\nDisallow: /private/*/secret$\n",
        "SEOmiDesktopBot/1.0",
    );

    assert!(!robots_allows(
        &url::Url::parse("https://example.com/private/a/secret").unwrap(),
        &rules
    ));
    assert!(robots_allows(
        &url::Url::parse("https://example.com/private/a/secret/more").unwrap(),
        &rules
    ));
}
