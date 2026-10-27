use super::models::GscPerformanceFilters;
use super::{
    mapping::{map_joint_rows, map_performance},
    performance_transport::{dimensions, rows},
};
use serde_json::Value;

pub(super) async fn run(
    client: &reqwest::Client,
    access_token: &str,
    endpoint: Option<&str>,
    site_url: &str,
    start: &str,
    end: &str,
    filters: &GscPerformanceFilters,
) -> Result<Value, String> {
    let (queries, pages, totals, daily, joint) = tokio::try_join!(
        rows(
            client,
            access_token,
            endpoint,
            site_url,
            start,
            end,
            Some("query"),
            filters
        ),
        rows(
            client,
            access_token,
            endpoint,
            site_url,
            start,
            end,
            Some("page"),
            filters
        ),
        rows(
            client,
            access_token,
            endpoint,
            site_url,
            start,
            end,
            None,
            filters
        ),
        rows(
            client,
            access_token,
            endpoint,
            site_url,
            start,
            end,
            Some("date"),
            filters
        ),
        dimensions(
            client,
            access_token,
            endpoint,
            site_url,
            start,
            end,
            &["query", "page"],
            filters
        ),
    )?;
    let mut output = map_performance(
        site_url,
        start,
        end,
        &queries.rows,
        &pages.rows,
        &totals.rows,
        &daily.rows,
        filters,
        queries.may_be_truncated,
        pages.may_be_truncated,
    )?;
    output["query_pages"] = serde_json::json!(map_joint_rows(&joint.rows)?);
    output["query_pages_may_be_truncated"] = serde_json::json!(joint.may_be_truncated);
    Ok(output)
}
