use super::setup::CrawlSetup;
use std::net::IpAddr;

/// Robots may move from the entered host to its ordinary www/root alias.
/// Configured hosts and the existing subdomain setting remain the only other
/// ways to extend that scope; this never turns arbitrary redirects into crawl
/// targets.
pub(super) fn robots_allowed_hosts(setup: &CrawlSetup) -> Vec<String> {
    let mut hosts = setup.config.allowed_hosts.clone();
    let Some(base_host) = setup.parsed_base.host_str() else {
        return hosts;
    };
    let base_host = base_host.trim_end_matches('.').to_ascii_lowercase();
    if base_host.parse::<IpAddr>().is_ok() {
        return hosts;
    }
    let canonical_alias = base_host
        .strip_prefix("www.")
        .map(str::to_owned)
        .unwrap_or_else(|| format!("www.{base_host}"));
    if canonical_alias != base_host && !hosts.iter().any(|host| host == &canonical_alias) {
        hosts.push(canonical_alias);
    }
    hosts
}

pub(super) const ROBOTS_MIN_REDIRECTS: usize = 5;
