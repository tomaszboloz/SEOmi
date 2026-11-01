use super::super::session::{CredentialStore, NativeCredentialStore};
use super::{
    admin,
    commands::{access_context, Endpoints, PRODUCTION},
    models::Ga4Status,
    revenue_model::{bad, request, Ga4RevenueReport, Ga4RevenueRow, Page},
    transport::{api_endpoint, post_json},
    validation::{
        access_token, date_range, host_matches, metric, normalize_host, property_name, site_scope,
        MAX_PAGES, REPORT_PAGE_SIZE, REPORT_ROW_MAX,
    },
};
use reqwest::Client;

#[allow(clippy::too_many_arguments)]
pub(super) async fn revenue_at(
    client: &Client,
    token: &str,
    property: &str,
    site_url: &str,
    host_name: &str,
    (start, end): (&str, &str),
    data_base: &str,
) -> Result<Ga4RevenueReport, String> {
    let token = access_token(token)?;
    let property = property_name(property)?;
    let scope = site_scope(site_url)?;
    let (start, end) = date_range(start, end)?;
    if !host_matches(&scope, host_name) {
        return Err("Google Analytics web stream is outside the selected site.".into());
    }
    let host = normalize_host(host_name)?;
    let endpoint = api_endpoint(data_base, &format!("{property}:runReport"));
    let (mut rows, mut currency, mut truncated) = (Vec::new(), None, false);
    for _ in 0..MAX_PAGES {
        let limit = REPORT_PAGE_SIZE.min(REPORT_ROW_MAX - rows.len());
        let body = request(&start, &end, &host, rows.len(), limit);
        let json = post_json(client, token, &endpoint, &body, "Google Analytics Data API").await?;
        let page: Page = serde_json::from_value(json).map_err(|_| bad("report"))?;
        currency = currency.or(page.metadata.and_then(|meta| meta.currency_code));
        for row in &page.rows {
            let (Some(Some(landing)), Some(amount)) = (
                row.dimensions.first().map(|v| v.value.clone()),
                row.metrics.first(),
            ) else {
                return Err(bad("row"));
            };
            let revenue = metric(amount.value.as_deref()).map_err(|_| bad("amount"))?;
            rows.push(Ga4RevenueRow {
                landing_page: landing,
                revenue,
            });
        }
        let total = page.row_count.unwrap_or(rows.len());
        if page.rows.is_empty() || rows.len() >= total.min(REPORT_ROW_MAX) {
            truncated = total > rows.len();
            break;
        }
        truncated = true;
    }
    let currency_code = currency
        .filter(|code| code.len() == 3 && code.bytes().all(|b| b.is_ascii_uppercase()))
        .ok_or_else(|| bad("currency"))?;
    let status = match (rows.is_empty(), truncated) {
        (true, _) => Ga4Status::Missing,
        (false, true) => Ga4Status::Partial,
        (false, false) => Ga4Status::Complete,
    };
    Ok(Ga4RevenueReport {
        status,
        property,
        host_name: host,
        start_date: start,
        end_date: end,
        currency_code,
        attribution: "ga4-session-landing-page".into(),
        rows,
        may_be_truncated: truncated,
    })
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn collect_revenue(
    client: &Client,
    token: &str,
    site_url: &str,
    range: (&str, &str),
    endpoints: &Endpoints<'_>,
) -> Result<Ga4RevenueReport, String> {
    let discovery =
        admin::discover_at(client, token, site_url, endpoints.accounts, endpoints.admin).await?;
    let property = discovery
        .property
        .ok_or("No Google Analytics property matches this site.")?;
    revenue_at(
        client,
        token,
        &property.name,
        site_url,
        &property.selected_host_name,
        range,
        endpoints.data,
    )
    .await
}

pub(super) async fn revenue_with(
    (project_id, client_id): (&str, &str),
    site_url: &str,
    range: (&str, &str),
    store: &dyn CredentialStore,
    endpoints: &Endpoints<'_>,
) -> Result<Ga4RevenueReport, String> {
    let (client, token) = access_context(project_id, client_id, store, endpoints).await?;
    collect_revenue(&client, &token, site_url, range, endpoints).await
}

#[tauri::command]
pub async fn google_analytics_revenue(
    project_id: String,
    client_id: String,
    site_url: String,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Ga4RevenueReport, String> {
    site_scope(&site_url)?;
    let range =
        super::super::dates::requested_date_range(start_date.as_deref(), end_date.as_deref())?;
    let ids = (project_id.as_str(), client_id.as_str());
    revenue_with(
        ids,
        &site_url,
        (&range.0, &range.1),
        &NativeCredentialStore,
        &PRODUCTION,
    )
    .await
}

#[cfg(test)]
#[path = "revenue_more_tests.rs"]
mod more_tests;
#[cfg(test)]
#[path = "revenue_tests.rs"]
mod tests;
