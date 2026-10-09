use std::time::Duration;

use super::super::{
    crawl_delay::parse_robots_crawl_delay,
    models::{CrawledRobotsAgent, CrawledRobotsRule},
    retry::{read_bounded_text_with_retry, send_get_with_retry},
    robots::{build_robots_agent_matrix, parse_robots_rules, RobotsRule},
    sitemap::parse_sitemap_directives,
};
use super::setup::CrawlSetup;

pub struct CrawlRobotsOutcome {
    pub robots_rules: Vec<RobotsRule>,
    pub robots_txt_status: String,
    pub robots_sitemaps: Vec<String>,
    pub robots_crawl_delay: Option<Duration>,
    pub robots_agent_matrix: Vec<CrawledRobotsAgent>,
    pub robots_applicable_rules: Vec<CrawledRobotsRule>,
    pub robots_sitemap_directives: Vec<String>,
}

pub async fn fetch_and_eval_robots(setup: &CrawlSetup) -> Result<CrawlRobotsOutcome, String> {
    let (robots_rules, robots_txt_status, robots_sitemaps, robots_crawl_delay, robots_agent_matrix) =
        if setup.config.respect_robots || setup.config.discover_sitemaps {
            let robots_url = setup
                .parsed_base
                .join("/robots.txt")
                .map_err(|error| format!("Failed to construct robots.txt URL: {error}"))?;
            let mut retry_available = true;
            let retry_context = setup.retry_context();
            match send_get_with_retry(
                &setup.client,
                robots_url.as_str(),
                &retry_context,
                &mut retry_available,
            )
            .await
            .map(|result| result.response)
            {
                Ok(response) if response.status().is_success() => {
                    match read_bounded_text_with_retry(
                        response,
                        setup.max_response_bytes,
                        &retry_context,
                    )
                    .await
                    {
                        Ok(content) => {
                            let rules = parse_robots_rules(&content, &setup.ua);
                            let rule_count = rules.len();
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
                            (
                                rules,
                                format!(
                                    "Loaded {rule_count} applicable robots.txt rules{delay_status}"
                                ),
                                parse_sitemap_directives(&content),
                                crawl_delay.filter(|_| {
                                    setup.config.respect_robots && setup.config.respect_crawl_delay
                                }),
                                build_robots_agent_matrix(&content, &setup.ua),
                            )
                        }
                        Err(error) => (
                            Vec::new(),
                            format!("robots.txt could not be read ({error}); URLs allowed"),
                            Vec::new(),
                            None,
                            Vec::new(),
                        ),
                    }
                }
                Ok(response) if response.status().as_u16() == 404 => (
                    Vec::new(),
                    "robots.txt not found; URLs allowed".into(),
                    Vec::new(),
                    None,
                    Vec::new(),
                ),
                Ok(response) => (
                    Vec::new(),
                    format!(
                        "robots.txt returned HTTP {}; URLs allowed",
                        response.status()
                    ),
                    Vec::new(),
                    None,
                    Vec::new(),
                ),
                Err(error) => (
                    Vec::new(),
                    format!("robots.txt unavailable ({error}); URLs allowed"),
                    Vec::new(),
                    None,
                    Vec::new(),
                ),
            }
        } else {
            (
                Vec::new(),
                "robots.txt checking disabled by this crawl configuration".into(),
                Vec::new(),
                None,
                Vec::new(),
            )
        };

    let robots_applicable_rules = robots_rules
        .iter()
        .map(|rule| CrawledRobotsRule {
            directive: if rule.allow { "allow" } else { "disallow" }.into(),
            path: rule.path.clone(),
        })
        .collect::<Vec<_>>();
    let robots_sitemap_directives = robots_sitemaps.clone();

    Ok(CrawlRobotsOutcome {
        robots_rules,
        robots_txt_status,
        robots_sitemaps,
        robots_crawl_delay,
        robots_agent_matrix,
        robots_applicable_rules,
        robots_sitemap_directives,
    })
}
