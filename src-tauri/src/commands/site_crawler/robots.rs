use super::*;

mod agent_matrix;
mod matching;
mod sitemaps;
pub(super) use agent_matrix::*;
pub(super) use matching::*;
pub(super) use sitemaps::*;

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
                !requested.is_empty() && requested != "*" && agent.contains(&requested)
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
                !requested.is_empty() && requested != "*" && agent.contains(&requested)
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

pub(super) fn robots_has_specific_agent_group(content: &str, crawler_agent: &str) -> bool {
    content.lines().any(|raw_line| {
        let line = raw_line.split('#').next().unwrap_or("").trim();
        let Some((key, value)) = line.split_once(':') else {
            return false;
        };
        let value = value.trim();
        // An empty User-agent value names no crawler (RFC 9309), and every
        // string "contains" the empty string.
        key.trim().eq_ignore_ascii_case("user-agent")
            && !value.is_empty()
            && value != "*"
            && crawler_agent.contains(&value.to_ascii_lowercase())
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
