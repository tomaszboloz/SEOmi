use chrono::NaiveDate;
use url::Url;

pub(super) const MAX_PAGES: usize = 25;
pub(super) const MAX_PROPERTIES: usize = 32;
pub(super) const PAGE_SIZE: usize = 200;
pub(super) const REPORT_PAGE_SIZE: usize = 10_000;
pub(super) const REPORT_ROW_MAX: usize = 25_000;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct SiteScope {
    pub(super) host: String,
    pub(super) domain_property: bool,
}

pub(super) fn access_token(token: &str) -> Result<&str, String> {
    let token = token.trim();
    (!token.is_empty())
        .then_some(token)
        .ok_or_else(|| "Google Analytics access token is missing.".into())
}

pub(super) fn property_name(value: &str) -> Result<String, String> {
    let value = value.trim();
    let id = value
        .strip_prefix("properties/")
        .filter(|id| {
            !id.is_empty() && id.len() <= 24 && id.bytes().all(|byte| byte.is_ascii_digit())
        })
        .ok_or_else(|| "Google Analytics returned an invalid property name.".to_string())?;
    Ok(format!("properties/{id}"))
}

pub(super) fn date_range(start: &str, end: &str) -> Result<(String, String), String> {
    let start_date = NaiveDate::parse_from_str(start, "%Y-%m-%d")
        .map_err(|_| "Google Analytics date range is invalid.".to_string())?;
    let end_date = NaiveDate::parse_from_str(end, "%Y-%m-%d")
        .map_err(|_| "Google Analytics date range is invalid.".to_string())?;
    if start_date > end_date {
        return Err("Google Analytics date range is invalid.".into());
    }
    Ok((start_date.to_string(), end_date.to_string()))
}

pub(super) fn site_scope(value: &str) -> Result<SiteScope, String> {
    let value = value.trim();
    if let Some(domain) = value.strip_prefix("sc-domain:") {
        let host = normalize_host(domain)?;
        return Ok(SiteScope {
            host,
            domain_property: true,
        });
    }
    let url = Url::parse(value).map_err(|_| "Google Analytics site URL is invalid.".to_string())?;
    if !matches!(url.scheme(), "http" | "https") || url.username() != "" || url.password().is_some()
    {
        return Err("Google Analytics site URL is invalid.".into());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "Google Analytics site URL is invalid.".to_string())?;
    Ok(SiteScope {
        host: normalize_host(host)?,
        domain_property: false,
    })
}

pub(super) fn normalize_host(value: &str) -> Result<String, String> {
    let host = value.trim().trim_end_matches('.').to_ascii_lowercase();
    if host.is_empty()
        || host.contains('/')
        || host.contains('@')
        || host.contains(char::is_whitespace)
    {
        return Err("Google Analytics site host is invalid.".into());
    }
    Ok(host)
}

pub(super) fn host_matches(scope: &SiteScope, candidate: &str) -> bool {
    let Ok(candidate) = normalize_host(candidate) else {
        return false;
    };
    candidate == scope.host
        || (scope.domain_property
            && candidate
                .strip_suffix(&format!(".{}", scope.host))
                .is_some_and(|prefix| !prefix.is_empty()))
}

pub(super) fn stream_host(uri: &str) -> Result<String, String> {
    let url = Url::parse(uri)
        .map_err(|_| "Google Analytics returned an invalid web stream URI.".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Google Analytics returned an invalid web stream URI.".into());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "Google Analytics returned an invalid web stream URI.".to_string())?;
    normalize_host(host)
}

pub(super) fn next_page_token(token: Option<String>) -> Result<Option<String>, String> {
    let Some(token) = token else { return Ok(None) };
    let token = token.trim().to_string();
    if token.is_empty() {
        return Ok(None);
    }
    if token.len() > 2048 {
        return Err("Google Analytics returned an invalid pagination token.".into());
    }
    Ok(Some(token))
}

pub(super) fn metric(value: Option<&str>) -> Result<f64, String> {
    value
        .and_then(|value| value.parse::<f64>().ok())
        .filter(|value| value.is_finite() && *value >= 0.0)
        .ok_or_else(|| "Google Analytics returned invalid report metrics.".into())
}
