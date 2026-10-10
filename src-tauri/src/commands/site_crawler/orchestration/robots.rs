use super::super::{
    models::{CrawledRedirectHop, CrawledRobotsAgent, CrawledRobotsRule},
    robots::RobotsRule,
    transport::request_with_safe_redirects_with_context,
};
use super::{
    robots_evaluation::{error_message, evaluate_response, response_status, unknown_evaluation},
    robots_scope::robots_allowed_hosts,
    setup::CrawlSetup,
};
use std::time::Duration;

pub(super) const ROBOTS_LOADED: &str = "loaded";
pub(super) const ROBOTS_UNKNOWN: &str = "unknown";
pub(super) const ROBOTS_DISABLED: &str = "disabled";

pub struct CrawlRobotsOutcome {
    pub robots_rules: Vec<RobotsRule>,
    pub robots_txt_status: String,
    pub robots_txt_evaluation_status: String,
    pub robots_txt_warning: Option<String>,
    pub robots_txt_status_code: Option<u16>,
    pub robots_txt_final_url: Option<String>,
    pub robots_txt_redirect_chain: Vec<CrawledRedirectHop>,
    pub robots_sitemaps: Vec<String>,
    pub robots_crawl_delay: Option<Duration>,
    pub robots_agent_matrix: Vec<CrawledRobotsAgent>,
    pub robots_applicable_rules: Vec<CrawledRobotsRule>,
    pub robots_sitemap_directives: Vec<String>,
}

pub async fn fetch_and_eval_robots(setup: &CrawlSetup) -> Result<CrawlRobotsOutcome, String> {
    let evaluation = if !(setup.config.respect_robots || setup.config.discover_sitemaps) {
        super::robots_evaluation::RobotsEvaluation {
            rules: Vec::new(),
            status: "robots.txt checking disabled by this crawl configuration".into(),
            state: ROBOTS_DISABLED.into(),
            warning: None,
            status_code: None,
            final_url: None,
            redirect_chain: Vec::new(),
            sitemaps: Vec::new(),
            crawl_delay: None,
            agent_matrix: Vec::new(),
        }
    } else {
        let robots_url = setup
            .parsed_base
            .join("/robots.txt")
            .map_err(|error| format!("Failed to construct robots.txt URL: {error}"))?;
        let fetched = request_with_safe_redirects_with_context(
            &setup.client,
            robots_url.as_str(),
            &setup.base_host,
            setup.config.allow_subdomains,
            None,
            &robots_allowed_hosts(setup),
            setup
                .max_redirects
                .max(super::robots_scope::ROBOTS_MIN_REDIRECTS),
            &setup.config,
            setup.retry_context(),
        )
        .await;
        match fetched {
            Ok(fetched) => {
                let final_url = Some(fetched.final_url.clone());
                let redirect_chain = fetched.redirect_chain;
                if let Some(reason) = fetched.redirect_stopped_reason {
                    unknown_evaluation(
                        reason,
                        response_status(&fetched.response),
                        final_url,
                        redirect_chain,
                    )
                } else {
                    evaluate_response(fetched.response, setup, final_url, redirect_chain).await
                }
            }
            Err(error) => unknown_evaluation(
                format!("unavailable: {}", error_message(error)),
                None,
                None,
                Vec::new(),
            ),
        }
    };
    let robots_applicable_rules = evaluation
        .rules
        .iter()
        .map(|rule| CrawledRobotsRule {
            directive: if rule.allow { "allow" } else { "disallow" }.into(),
            path: rule.path.clone(),
        })
        .collect::<Vec<_>>();
    let robots_sitemap_directives = evaluation.sitemaps.clone();
    Ok(CrawlRobotsOutcome {
        robots_rules: evaluation.rules,
        robots_txt_status: evaluation.status,
        robots_txt_evaluation_status: evaluation.state,
        robots_txt_warning: evaluation.warning,
        robots_txt_status_code: evaluation.status_code,
        robots_txt_final_url: evaluation.final_url,
        robots_txt_redirect_chain: evaluation.redirect_chain,
        robots_sitemaps: evaluation.sitemaps,
        robots_crawl_delay: evaluation.crawl_delay,
        robots_agent_matrix: evaluation.agent_matrix,
        robots_applicable_rules,
        robots_sitemap_directives,
    })
}
