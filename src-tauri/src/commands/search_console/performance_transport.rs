use super::models::{AnalyticsRows, GscPerformanceFilters};
use super::rows::{performance_dimensions, performance_dimensions_at, performance_rows};

#[allow(clippy::too_many_arguments)]
pub(super) async fn rows(
    client: &reqwest::Client,
    access_token: &str,
    endpoint: Option<&str>,
    site_url: &str,
    start: &str,
    end: &str,
    dimension: Option<&str>,
    filters: &GscPerformanceFilters,
) -> Result<AnalyticsRows, String> {
    match endpoint {
        Some(endpoint) => {
            let dimensions = dimension.into_iter().collect::<Vec<_>>();
            performance_dimensions_at(
                client,
                access_token,
                endpoint,
                start,
                end,
                &dimensions,
                filters,
            )
            .await
        }
        None => {
            performance_rows(
                client,
                access_token,
                site_url,
                start,
                end,
                dimension,
                filters,
            )
            .await
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn dimensions(
    client: &reqwest::Client,
    access_token: &str,
    endpoint: Option<&str>,
    site_url: &str,
    start: &str,
    end: &str,
    dimensions: &[&str],
    filters: &GscPerformanceFilters,
) -> Result<AnalyticsRows, String> {
    match endpoint {
        Some(endpoint) => {
            performance_dimensions_at(
                client,
                access_token,
                endpoint,
                start,
                end,
                dimensions,
                filters,
            )
            .await
        }
        None => {
            performance_dimensions(
                client,
                access_token,
                site_url,
                start,
                end,
                dimensions,
                filters,
            )
            .await
        }
    }
}
