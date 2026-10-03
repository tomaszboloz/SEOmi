use reqwest::header::{HeaderMap, HeaderName, HeaderValue, COOKIE, USER_AGENT};

use super::super::{models::CrawlConfig, scope::rendered_profile_has_unsupported_transport};
use crate::commands::settings::crawl_auth_profile;

pub fn build_crawler_client(
    project_id: Option<&str>,
    config: &CrawlConfig,
    user_agent: Option<String>,
) -> Result<(reqwest::Client, String, Option<String>), String> {
    let request_profile = match (project_id, config.request_profile_id.as_deref()) {
        (Some(project_id), Some(profile_id)) => Some(crawl_auth_profile(project_id, profile_id)?),
        (None, Some(_)) => {
            return Err("Select a project before using a saved request profile.".into())
        }
        _ => None,
    };
    if config.crawl_mode == "browser-rendered"
        && request_profile
            .as_ref()
            .is_some_and(rendered_profile_has_unsupported_transport)
    {
        return Err(
            "Browser-rendered crawl supports cookies from the selected profile only. Custom headers and proxy profiles require HTTP mode."
                .into(),
        );
    }
    let rendered_cookie = request_profile
        .as_ref()
        .and_then(|profile| profile.cookie.clone());
    let ua = config
        .user_agent
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(str::to_owned)
        .or(user_agent)
        .unwrap_or_else(|| "SEOmi-Crawler/0.1 (Desktop SEO Auditor)".into());
    if ua.len() > 1_024 {
        return Err("User-Agent exceeds the 1024-character safety limit.".into());
    }

    let mut headers = HeaderMap::new();
    let mut ua_value = HeaderValue::from_str(&ua).map_err(|_| "Invalid User-Agent value.")?;
    ua_value.set_sensitive(false);
    headers.insert(USER_AGENT, ua_value);
    let proxy_url = request_profile
        .as_ref()
        .and_then(|profile| profile.proxy_url.clone());
    if let Some(profile) = request_profile {
        for header in profile.headers {
            let Ok(header_name) = HeaderName::from_bytes(header.name.trim().as_bytes()) else {
                continue;
            };
            let Ok(mut header_value) = HeaderValue::from_str(&header.value) else {
                continue;
            };
            if header_name == reqwest::header::AUTHORIZATION
                || header.name.as_str().contains("token")
                || header.name.as_str().contains("key")
            {
                header_value.set_sensitive(true);
            }
            headers.append(header_name, header_value);
        }
        if let Some(cookie) = profile.cookie {
            if let Ok(mut cookie_value) = HeaderValue::from_str(&cookie) {
                cookie_value.set_sensitive(true);
                headers.insert(COOKIE, cookie_value);
            }
        }
    }
    let mut client_builder = super::super::transport::crawler_client_builder()
        .default_headers(headers)
        .redirect(reqwest::redirect::Policy::none());
    if let Some(timeout_secs) = config.request_timeout_secs {
        let clamped_timeout = timeout_secs.clamp(1, 120);
        client_builder = client_builder.timeout(std::time::Duration::from_secs(clamped_timeout));
    }
    if !config.verify_ssl {
        client_builder = client_builder.danger_accept_invalid_certs(true);
    }
    if let Some(proxy_url) = proxy_url {
        let proxy = reqwest::Proxy::all(&proxy_url)
            .map_err(|error| format!("Invalid proxy configuration: {error}"))?;
        client_builder = client_builder.proxy(proxy);
    }
    let client = client_builder
        .build()
        .map_err(|error| format!("Failed to initialize crawler HTTP client: {error}"))?;

    Ok((client, ua, rendered_cookie))
}
