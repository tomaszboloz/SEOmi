use super::super::session::{CredentialStore, NativeCredentialStore};
use super::{
    admin,
    commands::{access_context, Endpoints, PRODUCTION},
    daily_model::{bad, iso_date, page_path, request, Ga4DailyReport, Ga4DailyRow},
    models::Ga4Status,
    revenue_model::Page,
    transport::{api_endpoint, post_json},
    validation::{
        access_token, date_range, host_matches, metric, normalize_host, property_name, site_scope,
    },
};
use reqwest::Client;

pub(super) async fn daily_at(
    client: &Client,
    token: &str,
    (property, site_url, host_name): (&str, &str, &str),
    (start, end, page): (&str, &str, Option<String>),
    data_base: &str,
) -> Result<Ga4DailyReport, String> {
    let token = access_token(token)?;
    let property = property_name(property)?;
    let scope = site_scope(site_url)?;
    let (start, end) = date_range(start, end)?;
    let page = page_path(page)?;
    if !host_matches(&scope, host_name) {
        return Err("Google Analytics web stream is outside the selected site.".into());
    }
    let host = normalize_host(host_name)?;
    let endpoint = api_endpoint(data_base, &format!("{property}:runReport"));
    let body = request(&start, &end, &host, page.as_deref());
    let json = post_json(client, token, &endpoint, &body, "Google Analytics Data API").await?;
    let report: Page = serde_json::from_value(json).map_err(|_| bad("report"))?;
    let mut daily = Vec::new();
    for row in &report.rows {
        let (Some(date), Some(events), Some(revenue)) = (
            row.dimensions
                .first()
                .and_then(|v| v.value.as_deref())
                .and_then(iso_date),
            row.metrics.first().and_then(|v| v.value.as_deref()),
            row.metrics.get(1).and_then(|v| v.value.as_deref()),
        ) else {
            return Err(bad("row"));
        };
        let key_events = metric(Some(events)).map_err(|_| bad("amount"))?;
        let revenue = metric(Some(revenue)).map_err(|_| bad("amount"))?;
        daily.push(Ga4DailyRow {
            date,
            key_events,
            revenue,
        });
    }
    let currency_code = report
        .metadata
        .and_then(|meta| meta.currency_code)
        .filter(|code| code.len() == 3 && code.bytes().all(|b| b.is_ascii_uppercase()))
        .ok_or_else(|| bad("currency"))?;
    let truncated = report.row_count.is_some_and(|count| count > daily.len());
    let status = match (daily.is_empty(), truncated) {
        (true, _) => Ga4Status::Missing,
        (false, true) => Ga4Status::Partial,
        (false, false) => Ga4Status::Complete,
    };
    Ok(Ga4DailyReport {
        status,
        property,
        host_name: host,
        page_path: page,
        start_date: start,
        end_date: end,
        currency_code,
        daily,
        may_be_truncated: truncated,
    })
}

pub(super) async fn collect_daily(
    client: &Client,
    token: &str,
    site_url: &str,
    window: (&str, &str, Option<String>),
    endpoints: &Endpoints<'_>,
) -> Result<Ga4DailyReport, String> {
    let discovery =
        admin::discover_at(client, token, site_url, endpoints.accounts, endpoints.admin).await?;
    let property = discovery
        .property
        .ok_or("No Google Analytics property matches this site.")?;
    daily_at(
        client,
        token,
        (&property.name, site_url, &property.selected_host_name),
        window,
        endpoints.data,
    )
    .await
}

pub(super) async fn daily_with(
    (project_id, client_id): (&str, &str),
    site_url: &str,
    window: (&str, &str, Option<String>),
    store: &dyn CredentialStore,
    endpoints: &Endpoints<'_>,
) -> Result<Ga4DailyReport, String> {
    let (client, token) = access_context(project_id, client_id, store, endpoints).await?;
    collect_daily(&client, &token, site_url, window, endpoints).await
}

#[tauri::command]
pub async fn google_analytics_daily(
    project_id: String,
    client_id: String,
    site_url: String,
    start_date: Option<String>,
    end_date: Option<String>,
    page_path: Option<String>,
) -> Result<Ga4DailyReport, String> {
    site_scope(&site_url)?;
    super::daily_model::page_path(page_path.clone())?;
    let range =
        super::super::dates::requested_date_range(start_date.as_deref(), end_date.as_deref())?;
    let ids = (project_id.as_str(), client_id.as_str());
    daily_with(
        ids,
        &site_url,
        (&range.0, &range.1, page_path),
        &NativeCredentialStore,
        &PRODUCTION,
    )
    .await
}

#[cfg(test)]
#[path = "daily_command_tests.rs"]
mod command_tests;
#[cfg(test)]
#[path = "daily_more_tests.rs"]
mod more_tests;
#[cfg(test)]
#[path = "daily_tests.rs"]
mod tests;
