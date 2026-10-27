use crate::services::http_client::{check_url_status, fetch_registry_page, FetchResult};
use crate::utils::url_validator::validate_and_normalize_url;
use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Debug, Serialize, Deserialize)]
pub struct LinkStatusResult {
    pub url: String,
    pub status: u16,
    pub response_time_ms: u64,
    pub is_broken: bool,
}

#[derive(Debug, Serialize)]
pub struct RegistryProfileResult {
    pub url: String,
    pub final_url: String,
    pub status: u16,
    pub body: String,
    pub source_date: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum RegistryTarget {
    Orcid(String),
    Wikidata(String),
}

fn host_matches(host: &str, domain: &str) -> bool {
    host == domain || host.ends_with(&format!(".{domain}"))
}

fn orcid_checksum_valid(id: &str) -> bool {
    let digits: Vec<char> = id.chars().filter(|c| *c != '-').collect();
    if digits.len() != 16 || !digits[..15].iter().all(|c| c.is_ascii_digit()) {
        return false;
    }
    let total = digits[..15]
        .iter()
        .copied()
        .fold(0u32, |sum, digit| (sum + digit.to_digit(10).unwrap()) * 2);
    let check = (12 - (total % 11)) % 11;
    let expected = if check == 10 { 'X' } else { char::from_digit(check, 10).unwrap() };
    digits[15] == expected
}

fn registry_target(input: &str) -> Result<(RegistryTarget, Url), String> {
    let url = Url::parse(input.trim()).map_err(|_| "Invalid registry profile URL".to_string())?;
    if url.scheme() != "https" || url.query().is_some() || url.fragment().is_some()
        || url.username() != "" || url.password().is_some()
        || url.port().is_some_and(|port| port != 443)
    {
        return Err("Registry profile must be an HTTPS URL without credentials, query, or custom port".into());
    }
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let path = url.path().trim_end_matches('/');
    let target = if host_matches(&host, "orcid.org") {
        let id = path.strip_prefix('/').unwrap_or_default();
        if id.len() == 19 && id.as_bytes()[4] == b'-' && id.as_bytes()[9] == b'-'
            && id.as_bytes()[14] == b'-' && orcid_checksum_valid(id)
        {
            RegistryTarget::Orcid(id.to_ascii_uppercase())
        } else { return Err("Invalid ORCID profile identifier".into()); }
    } else if host_matches(&host, "wikidata.org") {
        let id = path.strip_prefix("/wiki/").or_else(|| path.strip_prefix("/entity/"));
        let valid = id.is_some_and(|value| value.starts_with('Q') && value[1..].chars().all(|c| c.is_ascii_digit()) && value[1..].chars().next().is_some_and(|c| c != '0'));
        if valid { RegistryTarget::Wikidata(id.unwrap().to_string()) } else { return Err("Invalid Wikidata entity identifier".into()); }
    } else { return Err("Registry profile host is not allow-listed".into()); };
    Ok((target, url))
}

fn api_url(target: &RegistryTarget, person: bool) -> Url {
    let path = match target {
        RegistryTarget::Orcid(id) if person => format!("https://pub.orcid.org/v3.0/{id}/person"),
        RegistryTarget::Orcid(id) => format!("https://pub.orcid.org/v3.0/{id}"),
        RegistryTarget::Wikidata(id) => format!("https://www.wikidata.org/wiki/Special:EntityData/{id}.json"),
    };
    Url::parse(&path).expect("registry API URL is static and valid")
}

fn has_orcid_id(body: &str, id: &str) -> bool { body.to_ascii_lowercase().contains(&id.to_ascii_lowercase()) }

fn result_from_fetch(url: String, fetched: FetchResult) -> RegistryProfileResult {
    RegistryProfileResult { url, final_url: fetched.final_url, status: fetched.status, body: fetched.body, source_date: fetched.headers.get("last-modified").cloned().or_else(|| fetched.headers.get("date").cloned()) }
}

#[tauri::command]
pub async fn fetch_registry_profile(url: String) -> Result<RegistryProfileResult, String> {
    let (target, _) = registry_target(&url)?;
    let first = fetch_registry_page(&api_url(&target, matches!(target, RegistryTarget::Orcid(_))))
        .await.map_err(|error| format!("Registry request failed: {error}"))?;
    let fetched = if let RegistryTarget::Orcid(id) = &target {
        if (200..300).contains(&first.status) && !has_orcid_id(&first.body, id) {
            fetch_registry_page(&api_url(&target, false)).await.map_err(|error| format!("Registry fallback failed: {error}"))?
        } else { first }
    } else { first };
    Ok(result_from_fetch(url, fetched))
}

#[tauri::command]
pub async fn check_link(
    url: String,
    timeout_secs: Option<u64>,
) -> Result<LinkStatusResult, String> {
    check_link_with_status(url, timeout_secs, |url, timeout| async move {
        check_url_status(&url, timeout).await
    })
    .await
}

async fn check_link_with_status<F, Fut>(
    url: String,
    timeout_secs: Option<u64>,
    request: F,
) -> Result<LinkStatusResult, String>
where
    F: FnOnce(String, u64) -> Fut,
    Fut: std::future::Future<Output = anyhow::Result<(u16, u64)>>,
{
    let validated =
        validate_and_normalize_url(&url).map_err(|e| format!("Invalid link URL: {}", e))?;

    let timeout = timeout_secs.unwrap_or(5).clamp(1, 15);
    match request(validated.to_string(), timeout).await {
        Ok((status, time_ms)) => Ok(LinkStatusResult {
            url,
            status,
            response_time_ms: time_ms,
            is_broken: status >= 400,
        }),
        Err(_e) => Ok(LinkStatusResult {
            url,
            status: 0,
            response_time_ms: 0,
            is_broken: true,
        }),
    }
}

#[cfg(test)]
#[path = "http_client_tests.rs"]
mod tests;
