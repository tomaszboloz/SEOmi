use super::*;

#[test]
fn an_empty_user_agent_line_does_not_replace_the_wildcard_group() {
    let content = "User-agent:\nAllow: /\n\nUser-agent: *\nDisallow: /private\n";
    assert!(!robots_has_specific_agent_group(content, "seomibot/1.0"));
    let rules = parse_robots_rules(content, "SEOmiBot/1.0");
    let private = url::Url::parse("https://example.com/private/page").unwrap();
    assert!(!robots_allows(&private, &rules));
}

#[test]
fn oversized_wildcard_rules_still_match_instead_of_failing_open() {
    let pattern = format!("/{}private", "*".repeat(20_000));
    assert!(robots_path_matches(&pattern, "/a/b/private/x"));
    assert!(!robots_path_matches(&pattern, "/a/b/public"));
    let rules = vec![RobotsRule {
        allow: false,
        path: pattern,
    }];
    let url = url::Url::parse("https://example.com/x/private").unwrap();
    assert!(!robots_allows(&url, &rules));
}

#[test]
fn robots_wildcards_and_end_anchor_follow_rfc_9309() {
    assert!(robots_path_matches("/", "/anything"));
    assert!(robots_path_matches("/*.php$", "/a/b.php"));
    assert!(!robots_path_matches("/*.php$", "/a/b.php?x=1"));
    assert!(robots_path_matches("/*.php", "/a/b.php?x=1"));
    assert!(robots_path_matches("/a*b*c", "/aXXbYYc/z"));
    assert!(!robots_path_matches("/a*b*c", "/aXXcYYb"));
    assert!(robots_path_matches("/fish$", "/fish"));
    assert!(!robots_path_matches("/fish$", "/fish/"));
    assert!(robots_path_matches("/%7Euser", "/~user/page"));
    assert!(robots_path_matches("/caf%C3%A9", "/café"));
    assert!(robots_path_matches("/a.b", "/a.b"));
    assert!(!robots_path_matches("/a.b", "/axb"));
    assert!(robots_path_matches("$", ""));
    assert!(robots_path_matches("*", "/x"));
}
