use super::models::GscPerformanceFilters;
use super::{
    credentials::validate_client_id,
    dates::requested_date_range,
    filters::normalize_filters,
    mapping::{map_joint_rows, map_performance},
    rows::{performance_dimensions, performance_rows},
    tokens::refresh_access_token,
};
use serde_json::Value;
use tokio::time::Duration;

pub(super) async fn search_console_performance(
    project_id: String,
    client_id: String,
    site_url: String,
    start_date: Option<String>,
    end_date: Option<String>,
    filters: Option<GscPerformanceFilters>,
) -> Result<Value, String> {
    let client_id = validate_client_id(&client_id)?;
    if site_url.trim().is_empty() {
        return Err("Wybierz property Search Console.".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let (start, end) = requested_date_range(start_date.as_deref(), end_date.as_deref())?;
    let filters = normalize_filters(filters)?;
    let access_token = refresh_access_token(&client, &project_id, &client_id).await?;
    let (queries, pages, totals, daily, joint) = tokio::try_join!(
        performance_rows(
            &client,
            &access_token,
            &site_url,
            &start,
            &end,
            Some("query"),
            &filters,
        ),
        performance_rows(
            &client,
            &access_token,
            &site_url,
            &start,
            &end,
            Some("page"),
            &filters,
        ),
        performance_rows(
            &client,
            &access_token,
            &site_url,
            &start,
            &end,
            None,
            &filters
        ),
        performance_rows(
            &client,
            &access_token,
            &site_url,
            &start,
            &end,
            Some("date"),
            &filters,
        ),
        performance_dimensions(
            &client,
            &access_token,
            &site_url,
            &start,
            &end,
            &["query", "page"],
            &filters
        ),
    )?;
    let mut output = map_performance(
        &site_url,
        &start,
        &end,
        &queries.rows,
        &pages.rows,
        &totals.rows,
        &daily.rows,
        &filters,
        queries.may_be_truncated,
        pages.may_be_truncated,
    );
    output["query_pages"] = serde_json::json!(map_joint_rows(&joint.rows)?);
    output["query_pages_may_be_truncated"] = serde_json::json!(joint.may_be_truncated);
    Ok(output)
}
