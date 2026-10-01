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

pub(super) fn parse_robots_crawl_delay(
    content: &str,
    crawler_agent: &str,
) -> Option<std::time::Duration> {
    let agent = crawler_agent.to_ascii_lowercase();
    let use_specific_group = robots_has_specific_agent_group(content, &agent);
    let mut active_group = false;
    let mut saw_directive = false;
    let mut crawl_delay = None;
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
            if saw_directive {
                active_group = false;
                saw_directive = false;
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
        if active_group && (key == "allow" || key == "disallow" || key == "crawl-delay") {
            saw_directive = true;
        }
        if active_group && key == "crawl-delay" {
            if let Ok(seconds) = value.parse::<f64>() {
                if seconds.is_finite() && seconds > 0.0 {
                    crawl_delay = Some(std::time::Duration::from_millis(
                        (seconds * 1_000.0).round().clamp(1.0, 60_000.0) as u64,
                    ));
                }
            }
        }
    }
    crawl_delay
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

pub(super) async fn wait_for_crawl_delay(
    control: &CrawlControl,
    run_id: &str,
    last_request_at: Instant,
    delay: std::time::Duration,
) -> bool {
    while let Some(remaining) = delay.checked_sub(last_request_at.elapsed()) {
        if control.is_cancelled(run_id) {
            return false;
        }
        if control.is_paused(run_id) && !control.wait_until_resumed(run_id).await {
            return false;
        }
        tokio::time::sleep(remaining.min(std::time::Duration::from_millis(100))).await;
    }
    !control.is_cancelled(run_id)
}

pub(super) fn robots_deciding_rule<'a>(
    url: &url::Url,
    rules: &'a [RobotsRule],
) -> Option<&'a RobotsRule> {
    let requested = match url.query() {
        Some(query) => format!("{}?{}", url.path(), query),
        None => url.path().to_string(),
    };
    let mut best: Option<&RobotsRule> = None;
    for rule in rules {
        if robots_path_matches(&rule.path, &requested)
            && best
                .map(|current| {
                    robots_rule_specificity(&rule.path) > robots_rule_specificity(&current.path)
                        || (robots_rule_specificity(&rule.path)
                            == robots_rule_specificity(&current.path)
                            && rule.allow
                            && !current.allow)
                })
                .unwrap_or(true)
        {
            best = Some(rule);
        }
    }
    best
}

pub(super) fn robots_rule_specificity(pattern: &str) -> usize {
    pattern
        .trim_end_matches('$')
        .bytes()
        .filter(|byte| *byte != b'*')
        .count()
}

pub(super) fn robots_path_matches(pattern: &str, requested: &str) -> bool {
    let anchored = pattern.ends_with('$');
    let pattern = pattern.strip_suffix('$').unwrap_or(pattern);
    let pattern = percent_decode_robots_path(pattern);
    let requested = percent_decode_robots_path(requested);
    let regex_pattern = format!(
        "^{}{}",
        pattern
            .split('*')
            .map(regex::escape)
            .collect::<Vec<_>>()
            .join(".*"),
        if anchored { "$" } else { "" }
    );
    Regex::new(&regex_pattern)
        .map(|regex| regex.is_match(&requested))
        .unwrap_or(false)
}

/// Decode valid percent-encoded octets before matching robots paths. URL
/// parsers preserve escaped bytes in `Url::path()`, while robots rules are
/// commonly authored with either the escaped or human-readable spelling.
/// Invalid escapes are kept verbatim so malformed rules remain harmless and
/// deterministic instead of becoming a broader match.
pub(super) fn percent_decode_robots_path(value: &str) -> String {
    fn hex_digit(value: u8) -> Option<u8> {
        match value {
            b'0'..=b'9' => Some(value - b'0'),
            b'a'..=b'f' => Some(value - b'a' + 10),
            b'A'..=b'F' => Some(value - b'A' + 10),
            _ => None,
        }
    }

    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let (Some(high), Some(low)) =
                (hex_digit(bytes[index + 1]), hex_digit(bytes[index + 2]))
            {
                decoded.push((high << 4) | low);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&decoded).into_owned()
}

pub(super) fn robots_allows(url: &url::Url, rules: &[RobotsRule]) -> bool {
    robots_deciding_rule(url, rules).map_or(true, |rule| rule.allow)
}

pub(super) fn parse_sitemap_directives(content: &str) -> Vec<String> {
    content
        .lines()
        .filter_map(|raw_line| {
            let line = raw_line.split('#').next().unwrap_or("").trim();
            let (key, value) = line.split_once(':')?;
            (key.trim().eq_ignore_ascii_case("sitemap") && !value.trim().is_empty())
                .then(|| value.trim().to_string())
        })
        .collect()
}

pub(super) fn parse_sitemap_locations(content: &str) -> Vec<String> {
    Regex::new(r"(?is)<loc\s*>\s*(.*?)\s*</loc>")
        .ok()
        .map(|pattern| {
            pattern
                .captures_iter(content)
                .filter_map(|captures| captures.get(1))
                .map(|capture| capture.as_str().trim().to_string())
                .filter(|url| !url.is_empty())
                .collect()
        })
        .unwrap_or_default()
}
