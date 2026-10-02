use super::*;

pub(in crate::commands::site_crawler) const ROBOTS_AGENT_MATRIX: [&str; 7] = [
    "Googlebot",
    "Bingbot",
    "GPTBot",
    "ClaudeBot",
    "Google-Extended",
    "Applebot",
    "*",
];

pub(in crate::commands::site_crawler) fn build_robots_agent_matrix(
    content: &str,
    effective_user_agent: &str,
) -> Vec<CrawledRobotsAgent> {
    let mut identities = Vec::with_capacity(ROBOTS_AGENT_MATRIX.len() + 1);
    identities.push(effective_user_agent.trim().to_string());
    identities.extend(ROBOTS_AGENT_MATRIX.iter().map(|agent| (*agent).to_string()));
    let mut seen = HashSet::new();
    identities
        .into_iter()
        .filter(|agent| !agent.is_empty() && seen.insert(agent.to_ascii_lowercase()))
        .map(|user_agent| {
            let rules = parse_robots_rules(content, &user_agent);
            let crawl_delay = parse_robots_crawl_delay(content, &user_agent)
                .map(|delay| delay.as_millis().min(u64::MAX as u128) as u64);
            let normalized_agent = user_agent.to_ascii_lowercase();
            CrawledRobotsAgent {
                specific_group: robots_has_specific_agent_group(content, &normalized_agent),
                user_agent,
                applicable_rules: rules
                    .into_iter()
                    .take(MAX_ROBOTS_RULES)
                    .map(|rule| CrawledRobotsRule {
                        directive: if rule.allow { "allow" } else { "disallow" }.into(),
                        path: rule.path,
                    })
                    .collect(),
                crawl_delay_ms: crawl_delay,
            }
        })
        .collect()
}
