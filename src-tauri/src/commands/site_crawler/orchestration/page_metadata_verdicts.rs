use super::super::models::{
    build_indexability_verdict, build_robots_decision, CrawlConfig, CrawledIndexabilityVerdict,
    CrawledRobotsDecision,
};

pub struct PageVerdictsOutcome {
    pub robots_decision: Option<CrawledRobotsDecision>,
    pub indexability_verdict: Option<CrawledIndexabilityVerdict>,
    pub indexability_status: String,
}

#[allow(clippy::too_many_arguments)]
pub fn evaluate_page_verdicts(
    status: u16,
    config: &CrawlConfig,
    meta_robots: Option<&str>,
    x_robots_tag: Option<&str>,
    meta_noindex: bool,
    header_noindex: bool,
    meta_nofollow: bool,
    header_nofollow: bool,
    canonical_points_elsewhere: bool,
) -> PageVerdictsOutcome {
    let indexability_status = if status == 0 && config.crawl_mode == "browser-rendered" {
        "HTTP status unavailable from rendered document".to_string()
    } else if status >= 400 {
        "Blocked by HTTP error".to_string()
    } else if meta_noindex || header_noindex {
        "Excluded by robots directive".to_string()
    } else if canonical_points_elsewhere {
        "Canonical points to a different URL".to_string()
    } else if meta_nofollow || header_nofollow {
        "Eligible from this response only; link following is restricted".to_string()
    } else if status >= 300 {
        "Redirect response — target not evaluated".to_string()
    } else if config.crawl_mode == "browser-rendered" {
        "Rendered DOM checked; X-Robots-Tag response header unavailable".to_string()
    } else {
        "Eligible from this response only".to_string()
    };

    let robots_decision = Some(build_robots_decision(
        meta_robots,
        x_robots_tag,
        config.crawl_mode != "browser-rendered",
    ));
    let indexability_verdict = Some(build_indexability_verdict(
        status,
        &config.crawl_mode,
        meta_noindex,
        header_noindex,
        canonical_points_elsewhere,
        meta_nofollow,
        header_nofollow,
    ));

    PageVerdictsOutcome {
        robots_decision,
        indexability_verdict,
        indexability_status,
    }
}
