use super::{
    credentials::validate_client_id,
    dates::requested_date_range,
    performance::performance_client,
    requests::site_path,
    session::{CredentialStore, NativeCredentialStore, TOKEN_ENDPOINT},
    tokens::{refresh_access_token_with_store, token_json},
};
use serde_json::{json, Value};
use url::Url;

const ROW_LIMIT: usize = 1000;

/// A page URL is only queried when it belongs to the selected property, so a crafted URL cannot widen the query.
fn page_in_property(site_url: &str, page_url: &str) -> Result<String, String> {
    let page = Url::parse(page_url).map_err(|_| "Page URL is invalid.".to_string())?;
    let host = page.host_str().unwrap_or_default().to_ascii_lowercase();
    let inside = match site_url.strip_prefix("sc-domain:") {
        Some(domain) => {
            let domain = domain.trim().to_ascii_lowercase();
            host == domain || host.ends_with(&format!(".{domain}"))
        }
        None => page_url.starts_with(site_url.trim()),
    };
    let plain = matches!(page.scheme(), "http" | "https")
        && page.username().is_empty()
        && page.password().is_none();
    if plain && inside {
        Ok(page.to_string())
    } else {
        Err("Page URL is outside the selected Search Console property.".into())
    }
}

fn payload(start: &str, end: &str, page: &str) -> Value {
    json!({
        "startDate": start, "endDate": end, "dimensions": ["date"], "rowLimit": ROW_LIMIT, "startRow": 0,
        "dimensionFilterGroups": [{"groupType": "and", "filters": [{"dimension": "page", "operator": "equals", "expression": page}]}]
    })
}

/// Daily clicks and impressions of one page (#97): the series a per-URL counterfactual needs.
#[tauri::command]
pub async fn search_console_page_daily(
    project_id: String,
    client_id: String,
    site_url: String,
    page_url: String,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Value, String> {
    page_daily_with(
        (project_id, client_id, site_url, page_url),
        (start_date, end_date),
        &NativeCredentialStore,
        (TOKEN_ENDPOINT, None),
    )
    .await
}

pub(super) async fn page_daily_with(
    (project_id, client_id, site_url, page_url): (String, String, String, String),
    (start_date, end_date): (Option<String>, Option<String>),
    store: &dyn CredentialStore,
    (token_url, endpoint_override): (&str, Option<&str>),
) -> Result<Value, String> {
    let client_id = validate_client_id(&client_id)?;
    let page = page_in_property(&site_url, &page_url)?;
    let (start, end) = requested_date_range(start_date.as_deref(), end_date.as_deref())?;
    let client = performance_client(reqwest::Client::builder())?;
    let token =
        refresh_access_token_with_store(&client, &project_id, &client_id, store, token_url).await?;
    let default_endpoint = format!(
        "https://searchconsole.googleapis.com/webmasters/v3/sites/{}/searchAnalytics/query",
        site_path(&site_url)
    );
    let endpoint = endpoint_override.unwrap_or(&default_endpoint);
    let body = token_json(
        &token,
        client.post(endpoint).json(&payload(&start, &end, &page)),
    )
    .await?;
    let rows = body
        .get("rows")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    Ok(json!({
        "page": page, "start_date": start, "end_date": end,
        "may_be_truncated": rows.len() >= ROW_LIMIT, "rows": rows,
    }))
}

#[cfg(test)]
#[path = "page_daily_tests.rs"]
mod tests;
