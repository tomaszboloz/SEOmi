use super::*;

#[test]
fn robots_parser_ignores_empty_disallow_and_preserves_sitemap_directives() {
    let content =
        "User-agent: *\nDisallow:\nAllow: /public\nSitemap: https://example.com/sitemap.xml\n";
    let rules = parse_robots_rules(content, "SEOmiDesktopBot/1.0");

    assert_eq!(rules.len(), 1);
    assert!(robots_allows(
        &url::Url::parse("https://example.com/private").unwrap(),
        &rules
    ));
    assert_eq!(
        parse_sitemap_directives(content),
        vec!["https://example.com/sitemap.xml"]
    );
}

#[test]
fn robots_crawl_delay_is_parsed_for_the_active_agent_and_capped() {
    let delay = parse_robots_crawl_delay("User-agent: seomi\nCrawl-delay: 1.5\n", "seomi").unwrap();
    let capped_delay =
        parse_robots_crawl_delay("User-agent: *\nCrawl-delay: 999\n", "seomi").unwrap();

    assert_eq!(delay, std::time::Duration::from_millis(1_500));
    assert_eq!(capped_delay, std::time::Duration::from_secs(60));
}

#[test]
fn an_empty_user_agent_line_does_not_replace_the_wildcard_group() {
    let content = "User-agent:\nAllow: /\n\nUser-agent: *\nDisallow: /private\n";
    assert!(!robots_has_specific_agent_group(content, "seomibot/1.0"));
    let rules = parse_robots_rules(content, "SEOmiBot/1.0");
    let private = url::Url::parse("https://example.com/private/page").unwrap();
    assert!(!robots_allows(&private, &rules));
}
