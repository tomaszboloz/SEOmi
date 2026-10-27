use super::super::{
    crawl_delay::parse_robots_crawl_delay,
    fetch_types::FetchedPageBody,
    models::{CrawledRedirectHop, CrawledRobotsAgent},
    retry::{read_bounded_text_with_retry, RetryError},
    robots::{build_robots_agent_matrix, parse_robots_rules, RobotsRule},
    sitemap::parse_sitemap_directives,
};
use super::{robots::ROBOTS_UNKNOWN, setup::CrawlSetup};
use std::time::Duration;
pub(super) struct RobotsEvaluation {
    pub(super) rules: Vec<RobotsRule>,
    pub(super) status: String,
    pub(super) state: String,
    pub(super) warning: Option<String>,
    pub(super) status_code: Option<u16>,
    pub(super) final_url: Option<String>,
    pub(super) redirect_chain: Vec<CrawledRedirectHop>,
    pub(super) sitemaps: Vec<String>,
    pub(super) crawl_delay: Option<Duration>,
    pub(super) agent_matrix: Vec<CrawledRobotsAgent>,
}
pub(super) fn unknown_evaluation(
    reason: impl Into<String>,
    status_code: Option<u16>,
    final_url: Option<String>,
    redirect_chain: Vec<CrawledRedirectHop>,
) -> RobotsEvaluation {
    let reason = reason.into();
    RobotsEvaluation {
        rules: Vec::new(),
        status: format!("robots.txt could not be evaluated ({reason}); restrictions are unknown"),
        state: ROBOTS_UNKNOWN.into(),
        warning: Some(format!(
            "Robots rules could not be evaluated: {reason}. The crawl continued without applying robots restrictions; affected URL results may be incomplete."
        )),
        status_code,
        final_url,
        redirect_chain,
        sitemaps: Vec::new(),
        crawl_delay: None,
        agent_matrix: Vec::new(),
    }
}
pub(super) fn unrestricted_evaluation(
    status_code: u16,
    final_url: Option<String>,
    redirect_chain: Vec<CrawledRedirectHop>,
) -> RobotsEvaluation {
    RobotsEvaluation {
        rules: Vec::new(),
        status: if status_code == 404 {
            "robots.txt not found; no restrictions apply".into()
        } else {
            format!("robots.txt returned HTTP {status_code}; no restrictions apply")
        },
        state: "unrestricted".into(),
        warning: None,
        status_code: Some(status_code),
        final_url,
        redirect_chain,
        sitemaps: Vec::new(),
        crawl_delay: None,
        agent_matrix: Vec::new(),
    }
}
pub(super) fn response_status(response: &FetchedPageBody) -> Option<u16> {
    match response {
        FetchedPageBody::Http(response) => Some(response.status().as_u16()),
        _ => None,
    }
}
pub(super) fn error_message(error: RetryError) -> String {
    match error {
        RetryError::Deadline => "crawl deadline reached".into(),
        RetryError::Request(error) => error.to_string(),
    }
}
pub(super) async fn evaluate_response(
    response: FetchedPageBody,
    setup: &CrawlSetup,
    final_url: Option<String>,
    redirect_chain: Vec<CrawledRedirectHop>,
) -> RobotsEvaluation {
    let FetchedPageBody::Http(response) = response else {
        return unknown_evaluation(
            "robots response was not HTTP",
            None,
            final_url,
            redirect_chain,
        );
    };
    let status_code = response.status().as_u16();
    if response.status().is_client_error() && status_code != 429 {
        return unrestricted_evaluation(status_code, final_url, redirect_chain);
    }
    if !response.status().is_success() {
        return unknown_evaluation(
            format!("HTTP {status_code}"),
            Some(status_code),
            final_url,
            redirect_chain,
        );
    }
    let content = match read_bounded_text_with_retry(
        response,
        setup.max_response_bytes,
        &setup.retry_context(),
    )
    .await
    {
        Ok(content) => content,
        Err(error) => {
            return unknown_evaluation(
                format!("could not be read: {error}"),
                Some(status_code),
                final_url,
                redirect_chain,
            )
        }
    };
    let rules = parse_robots_rules(&content, &setup.ua);
    let crawl_delay = parse_robots_crawl_delay(&content, &setup.ua);
    let delay_status = crawl_delay
        .map(|delay| {
            let seconds = delay.as_secs_f64();
            if setup.config.respect_robots && setup.config.respect_crawl_delay {
                format!("; crawl-delay {seconds:.3}s is enforced")
            } else {
                format!("; crawl-delay {seconds:.3}s is ignored by configuration")
            }
        })
        .unwrap_or_default();
    RobotsEvaluation {
        status: format!(
            "Loaded {} applicable robots.txt rules{delay_status}",
            rules.len()
        ),
        state: super::robots::ROBOTS_LOADED.into(),
        warning: None,
        status_code: Some(status_code),
        final_url,
        redirect_chain,
        sitemaps: parse_sitemap_directives(&content),
        crawl_delay: crawl_delay
            .filter(|_| setup.config.respect_robots && setup.config.respect_crawl_delay),
        agent_matrix: build_robots_agent_matrix(&content, &setup.ua),
        rules,
    }
}
