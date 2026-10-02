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
        if proxy_url.len() > 2_048 {
            return Err("Proxy URL cannot exceed 2048 characters.".into());
        }
        let proxy =
            url::Url::parse(proxy_url).map_err(|_| "Invalid proxy URL in request profile.")?;
        if !matches!(proxy.scheme(), "http" | "https") || proxy.host_str().is_none() {
            return Err("Proxy URL must use HTTP or HTTPS and include a hostname.".into());
        }
    }
    Ok(())
}
