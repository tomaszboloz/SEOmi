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

#[test]
fn robots_rule_precedence_and_equal_specificity_favors_allow() {
    let url = url::Url::parse("https://example.com/section/page").unwrap();

    let rules1 = vec![
        RobotsRule {
            allow: false,
            path: "/section/page".into(),
        },
        RobotsRule {
            allow: true,
            path: "/section".into(),
        },
    ];
    let deciding1 = robots_deciding_rule(&url, &rules1).unwrap();
    assert!(!deciding1.allow);

    let rules2 = vec![
        RobotsRule {
            allow: true,
            path: "/section".into(),
        },
        RobotsRule {
            allow: false,
            path: "/section/page".into(),
        },
    ];
    let deciding2 = robots_deciding_rule(&url, &rules2).unwrap();
    assert!(!deciding2.allow);

    let rules3 = vec![
        RobotsRule {
            allow: false,
            path: "/section/page".into(),
        },
        RobotsRule {
            allow: true,
            path: "/section/page".into(),
        },
    ];
    let deciding3 = robots_deciding_rule(&url, &rules3).unwrap();
    assert!(deciding3.allow);

    let rules4 = vec![
        RobotsRule {
            allow: true,
            path: "/section/page".into(),
        },
        RobotsRule {
            allow: false,
            path: "/section/page".into(),
        },
    ];
    let deciding4 = robots_deciding_rule(&url, &rules4).unwrap();
    assert!(deciding4.allow);

    let rules5 = vec![
        RobotsRule {
            allow: false,
            path: "/section/page".into(),
        },
        RobotsRule {
            allow: false,
            path: "/section/page".into(),
        },
    ];
    assert!(!robots_deciding_rule(&url, &rules5).unwrap().allow);

    let rules6 = vec![RobotsRule {
        allow: false,
        path: "/other".into(),
    }];
    assert!(robots_deciding_rule(&url, &rules6).is_none());
    assert!(robots_allows(&url, &rules6));
}

#[test]
fn robots_path_percent_decode_malformed_and_boundary_cases() {
    assert_eq!(percent_decode_robots_path("/test%"), "/test%");
    assert_eq!(percent_decode_robots_path("/test%2"), "/test%2");
    assert_eq!(percent_decode_robots_path("/test%zz"), "/test%zz");
    assert_eq!(percent_decode_robots_path("/test%2g"), "/test%2g");
    assert_eq!(percent_decode_robots_path("/test%g2"), "/test%g2");
    assert_eq!(percent_decode_robots_path("/test%20space"), "/test space");
    assert_eq!(percent_decode_robots_path("/test%2Fslash"), "/test/slash");

    assert!(robots_path_matches("", "/any"));
    assert!(!robots_path_matches("/something", ""));

    assert!(!robots_path_matches("/CaseSensitive", "/casesensitive"));
    assert!(robots_path_matches("/CaseSensitive", "/CaseSensitive"));

    assert!(robots_path_matches("*", ""));
    assert!(robots_path_matches("/*", "/"));
    assert!(robots_path_matches("/*$", "/"));
    assert!(!robots_path_matches("/*$", "/sub"));
}
