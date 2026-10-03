#[path = "page_metadata_verdicts_inputs.rs"]
mod inputs;
pub use inputs::EvaluatePageVerdictsInput;

use super::super::models::{
    build_indexability_verdict, build_robots_decision, CrawlConfig, CrawledIndexabilityVerdict,
    CrawledRobotsDecision,
};

pub struct PageVerdictsOutcome {
    pub robots_decision: Option<CrawledRobotsDecision>,
    pub indexability_verdict: Option<CrawledIndexabilityVerdict>,
    pub indexability_status: String,
}

pub fn evaluate_page_verdicts(input: EvaluatePageVerdictsInput<'_>) -> PageVerdictsOutcome {
    let EvaluatePageVerdictsInput {
        status,
        config,
        meta_robots,
        x_robots_tag,
        meta_noindex,
        header_noindex,
        meta_nofollow,
        header_nofollow,
        canonical_points_elsewhere,
    } = input;
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
