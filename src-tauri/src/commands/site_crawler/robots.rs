use super::*;

#[derive(Debug, Clone)]
pub(super) struct RobotsRule {
    pub(super) allow: bool,
    pub(super) path: String,
}

pub(super) fn parse_robots_rules(content: &str, crawler_agent: &str) -> Vec<RobotsRule> {
    let agent = crawler_agent.to_ascii_lowercase();
    let use_specific_group = robots_has_specific_agent_group(content, &agent);
    let mut rules = Vec::new();
    let mut active_group = false;
    let mut saw_rule = false;
    for raw_line in content.lines() {
        let line = raw_line.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }
        let Some((key, raw_value)) = line.split_once(':') else {
            continue;
        };
        let key = key.trim().to_ascii_lowercase();
        let value = raw_value.trim();
        if key == "user-agent" {
            if saw_rule {
                active_group = false;
                saw_rule = false;
            }
            let requested = value.to_ascii_lowercase();
            let matches = if use_specific_group {
                requested != "*" && agent.contains(&requested)
            } else {
                requested == "*"
            };
            active_group = active_group || matches;
            continue;
        }
        if active_group && (key == "allow" || key == "disallow") {
            saw_rule = true;
            if !value.is_empty() {
                rules.push(RobotsRule {
                    allow: key == "allow",
                    path: value.to_string(),
                });
            }
        }
    }
    rules
}

pub(super) const ROBOTS_AGENT_MATRIX: [&str; 7] = [
    "Googlebot",
    "Bingbot",
    "GPTBot",
    "ClaudeBot",
    "Google-Extended",
    "Applebot",
    "*",
];

pub(super) fn build_robots_agent_matrix(
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

pub(super) fn robots_has_specific_agent_group(content: &str, crawler_agent: &str) -> bool {
    content.lines().any(|raw_line| {
        let line = raw_line.split('#').next().unwrap_or("").trim();
        let Some((key, value)) = line.split_once(':') else {
            return false;
        };
        key.trim().eq_ignore_ascii_case("user-agent")
            && !value.trim().eq_ignore_ascii_case("*")
            && crawler_agent.contains(&value.trim().to_ascii_lowercase())
    })
}
