use super::*;

pub(super) fn normalize_scope_path(path: Option<&str>) -> Option<String> {
    let path = path?.trim();
    if path.is_empty() || path == "/" {
        return None;
    }
    let normalized = format!("/{}", path.trim_matches('/'));
    Some(normalized)
}

pub(super) fn normalize_allowed_hosts(values: &[String]) -> Result<Vec<String>, String> {
    let mut normalized = Vec::new();
    for raw in values {
        let candidate = raw.trim();
        if candidate.is_empty() {
            continue;
        }
        let parsed = if candidate.contains("://") {
            url::Url::parse(candidate)
        } else {
            url::Url::parse(&format!("https://{candidate}"))
        }
        .map_err(|_| format!("Invalid allowed host `{candidate}`"))?;
        if parsed.path() != "/"
            || parsed.query().is_some()
            || parsed.fragment().is_some()
            || !parsed.username().is_empty()
            || parsed.password().is_some()
            || parsed.port().is_some()
        {
            return Err(format!(
                "Allowed host must contain only a hostname: `{candidate}`"
            ));
        }
        let host = parsed
            .host_str()
            .ok_or_else(|| format!("Allowed host has no hostname: `{candidate}`"))?
            .trim_end_matches('.')
            .to_ascii_lowercase();
        if host.is_empty() || !normalized.iter().any(|item| item == &host) {
            normalized.push(host);
        }
    }
    Ok(normalized)
}

pub(super) fn host_matches_root(host: &str, root: &str, allow_subdomains: bool) -> bool {
    host.eq_ignore_ascii_case(root)
        || (allow_subdomains
            && host
                .to_ascii_lowercase()
                .ends_with(&format!(".{}", root.to_ascii_lowercase())))
}

pub(super) fn matches_scope(
    url: &url::Url,
    base_host: &str,
    allow_subdomains: bool,
    scope_path: Option<&str>,
    allowed_hosts: &[String],
) -> bool {
    let Some(host) = url.host_str() else {
        return false;
    };
    let is_base_host = host_matches_root(host, base_host, allow_subdomains);
    let is_allowed_host = allowed_hosts
        .iter()
        .any(|allowed| host_matches_root(host, allowed, allow_subdomains));
    if !is_base_host && !is_allowed_host {
        return false;
    }
    // A path scope belongs to the seed host. Explicitly allowlisted hosts are
    // already opt-in and must not accidentally inherit the seed's directory.
    if !is_base_host {
        return true;
    }
    let Some(scope_path) = normalize_scope_path(scope_path) else {
        return true;
    };
    let page_path = url.path();
    page_path == scope_path || page_path.starts_with(&format!("{scope_path}/"))
}

pub(super) fn matches_filters(url: &str, include: &[Regex], exclude: &[Regex]) -> bool {
    (include.is_empty() || include.iter().any(|pattern| pattern.is_match(url)))
        && !exclude.iter().any(|pattern| pattern.is_match(url))
}

pub(super) fn rendered_profile_has_unsupported_transport(profile: &CrawlAuthProfile) -> bool {
    !profile.headers.is_empty() || profile.proxy_url.is_some()
}
