use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledRobotsAgent {
    pub user_agent: String,
    pub specific_group: bool,
    pub applicable_rules: Vec<CrawledRobotsRule>,
    pub crawl_delay_ms: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledRobotsRule {
    pub directive: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CrawledRobotsDecision {
    pub indexability: String,
    pub link_following: String,
    #[serde(default)]
    pub directives: Vec<String>,
    #[serde(default)]
    pub sources: Vec<String>,
    pub response_headers_available: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledIndexabilityVerdict {
    pub status: String,
    #[serde(default)]
    pub reasons: Vec<String>,
}

pub fn robots_directive_tokens(value: Option<&str>) -> Vec<String> {
    value
        .into_iter()
        .flat_map(|raw| raw.split([',', ';']))
        .flat_map(|part| {
            let part = part.trim().to_ascii_lowercase();
            let part = part
                .rsplit_once(':')
                .map(|(_, directives)| directives)
                .unwrap_or(part.as_str());
            part.split_ascii_whitespace()
                .map(|token| {
                    token
                        .trim_matches(|character: char| {
                            !character.is_ascii_alphanumeric() && character != '-'
                        })
                        .to_owned()
                })
                .filter(|token| {
                    matches!(
                        token.as_str(),
                        "all" | "index" | "noindex" | "follow" | "nofollow" | "none"
                    )
                })
                .collect::<Vec<_>>()
        })
        .collect()
}

pub fn build_robots_decision(
    meta_robots: Option<&str>,
    x_robots_tag: Option<&str>,
    response_headers_available: bool,
) -> CrawledRobotsDecision {
    let mut directives = robots_directive_tokens(meta_robots);
    directives.extend(robots_directive_tokens(x_robots_tag));
    let mut sources = Vec::new();
    if meta_robots.is_some() {
        sources.push("meta robots".into());
    }
    if x_robots_tag.is_some() {
        sources.push("X-Robots-Tag".into());
    }
    let noindex = directives
        .iter()
        .any(|directive| directive == "noindex" || directive == "none");
    let nofollow = directives
        .iter()
        .any(|directive| directive == "nofollow" || directive == "none");
    CrawledRobotsDecision {
        indexability: if noindex { "noindex" } else { "index" }.into(),
        link_following: if nofollow { "nofollow" } else { "follow" }.into(),
        directives,
        sources,
        response_headers_available,
    }
}

pub fn build_indexability_verdict(
    status: u16,
    crawl_mode: &str,
    meta_noindex: bool,
    header_noindex: bool,
    canonical_points_elsewhere: bool,
    meta_nofollow: bool,
    header_nofollow: bool,
) -> CrawledIndexabilityVerdict {
    let mut reasons = Vec::new();
    if status >= 400 {
        reasons.push("http_error".into());
    }
    if meta_noindex || header_noindex {
        reasons.push("robots_noindex".into());
    }
    if canonical_points_elsewhere {
        reasons.push("canonical_points_elsewhere".into());
    }
    if meta_nofollow || header_nofollow {
        reasons.push("robots_nofollow".into());
    }
    if status >= 300 {
        reasons.push("redirect_response".into());
    }
    if status == 0 && crawl_mode == "browser-rendered" {
        reasons.push("http_status_unavailable".into());
    }
    if crawl_mode == "browser-rendered" {
        reasons.push("x_robots_header_unavailable".into());
    }
    let status = if status >= 400 || meta_noindex || header_noindex {
        "blocked"
    } else if status == 0
        || canonical_points_elsewhere
        || status >= 300
        || crawl_mode == "browser-rendered"
    {
        "uncertain"
    } else {
        "indexable"
    };
    CrawledIndexabilityVerdict {
        status: status.into(),
        reasons,
    }
}
