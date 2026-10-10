use super::super::page_metadata_verdicts::{evaluate_page_verdicts, EvaluatePageVerdictsInput};
use super::*;

fn assert_verdict(
    config: &CrawlConfig,
    status: u16,
    headers: bool,
    meta_robots: Option<&str>,
    x_robots_tag: Option<&str>,
    flags: (bool, bool, bool, bool, bool),
    expected: (&str, &str),
) {
    let (meta_noindex, header_noindex, meta_nofollow, header_nofollow, canonical) = flags;
    let outcome = evaluate_page_verdicts(EvaluatePageVerdictsInput {
        status,
        response_headers_available: headers,
        config,
        meta_robots,
        x_robots_tag,
        meta_noindex,
        header_noindex,
        meta_nofollow,
        header_nofollow,
        canonical_points_elsewhere: canonical,
    });
    assert_eq!(outcome.indexability_status, expected.0);
    assert_eq!(outcome.indexability_verdict.unwrap().status, expected.1);
    assert_eq!(
        outcome.robots_decision.unwrap().response_headers_available,
        headers
    );
}

#[test]
fn page_verdicts_cover_status_directives_canonical_redirect_and_rendered_uncertainty() {
    let http = default_crawl_config(None);
    let mut rendered = http.clone();
    rendered.crawl_mode = "browser-rendered".into();
    assert_verdict(
        &rendered,
        0,
        false,
        None,
        None,
        (false, false, false, false, false),
        (
            "HTTP status unavailable from rendered document",
            "uncertain",
        ),
    );
    assert_verdict(
        &http,
        500,
        true,
        None,
        None,
        (false, false, false, false, false),
        ("Blocked by HTTP error", "blocked"),
    );
    assert_verdict(
        &http,
        200,
        true,
        Some("noindex"),
        None,
        (true, false, false, false, false),
        ("Excluded by robots directive", "blocked"),
    );
    assert_verdict(
        &http,
        200,
        true,
        None,
        None,
        (false, false, false, false, true),
        ("Canonical points to a different URL", "uncertain"),
    );
    assert_verdict(
        &http,
        200,
        true,
        None,
        Some("nofollow"),
        (false, false, false, true, false),
        (
            "Eligible from this response only; link following is restricted",
            "indexable",
        ),
    );
    assert_verdict(
        &http,
        302,
        true,
        None,
        None,
        (false, false, false, false, false),
        ("Redirect response — target not evaluated", "uncertain"),
    );
    assert_verdict(
        &rendered,
        200,
        false,
        None,
        None,
        (false, false, false, false, false),
        (
            "Rendered DOM checked; X-Robots-Tag response header unavailable",
            "uncertain",
        ),
    );
    assert_verdict(
        &http,
        200,
        true,
        None,
        None,
        (false, false, false, false, false),
        ("Eligible from this response only", "indexable"),
    );
}
