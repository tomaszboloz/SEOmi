use super::types::CrawlAuthProfile;

pub(super) fn validate_crawl_auth_profile(profile: &CrawlAuthProfile) -> Result<(), String> {
    if profile.headers.len() > 50 {
        return Err("A request profile supports at most 50 custom headers.".into());
    }
    for header in &profile.headers {
        let name = header.name.trim();
        if name.is_empty()
            || name.len() > 256
            || reqwest::header::HeaderName::from_bytes(name.as_bytes()).is_err()
        {
            return Err(format!("Invalid custom header name `{}`.", header.name));
        }
        if matches!(
            name.to_ascii_lowercase().as_str(),
            "host"
                | "content-length"
                | "connection"
                | "transfer-encoding"
                | "cookie"
                | "user-agent"
        ) {
            return Err(format!(
                "The `{name}` header must be configured through its dedicated control."
            ));
        }
        if header.value.len() > 8_192
            || reqwest::header::HeaderValue::from_str(&header.value).is_err()
        {
            return Err(format!("Invalid value for custom header `{name}`."));
        }
    }
    if let Some(cookie) = &profile.cookie {
        if cookie.len() > 16_384 || reqwest::header::HeaderValue::from_str(cookie).is_err() {
            return Err("Invalid cookie value in request profile.".into());
        }
    }
    if let Some(proxy_url) = &profile.proxy_url {
        let list = crate::commands::site_crawler::proxy_pool::parse_proxy_list(proxy_url);
        crate::commands::site_crawler::proxy_pool::ProxyPool::new(
            &list,
            1,
            std::time::Duration::ZERO,
        )
        .map_err(|error| format!("Invalid proxy configuration: {error}"))?;
    }
    Ok(())
}
