use super::fragments::fold_fragment_rows;
use super::models::GscPerformanceFilters;
use super::requests::SEARCH_ROW_MAX;
use serde_json::{json, Value};

const INVALID_METRICS: &str = "Google returned invalid Search Console metrics.";

fn metric(row: &Value, name: &str) -> Result<f64, String> {
    row.get(name)
        .and_then(Value::as_f64)
        .filter(|value| value.is_finite() && *value >= 0.0)
        .ok_or_else(|| INVALID_METRICS.into())
}

fn map_metrics(row: &Value) -> Result<Value, String> {
    let ctr = metric(row, "ctr")?;
    if ctr > 1.0 {
        return Err(INVALID_METRICS.into());
    }
    Ok(json!({
        "clicks": metric(row, "clicks")?, "impressions": metric(row, "impressions")?,
        "ctr": (ctr * 100.0 * 10.0).round() / 10.0,
        "position": (metric(row, "position")? * 10.0).round() / 10.0,
    }))
}

fn map_analytics_row(row: &Value, key_name: &str) -> Result<Value, String> {
    let key = row
        .get("keys")
        .and_then(Value::as_array)
        .filter(|keys| keys.len() == 1)
        .and_then(|keys| keys.first())
        .and_then(Value::as_str)
        .filter(|key| !key.trim().is_empty())
        .ok_or_else(|| format!("Google returned an invalid {key_name} row."))?;
    let mut result = map_metrics(row)?;
    result[key_name] = Value::String(key.to_string());
    Ok(result)
}

pub(super) fn map_joint_rows(rows: &[Value]) -> Result<Vec<Value>, String> {
    rows.iter()
        .map(|row| {
            let keys = row
                .get("keys")
                .and_then(Value::as_array)
                .filter(|keys| {
                    keys.len() == 2
                        && keys
                            .iter()
                            .all(|key| key.as_str().is_some_and(|s| !s.trim().is_empty()))
                })
                .ok_or_else(|| "Google returned an invalid query/page pair.".to_string())?;
            if ["clicks", "impressions", "ctr", "position"]
                .iter()
                .any(|key| {
                    !row.get(key)
                        .and_then(Value::as_f64)
                        .is_some_and(|n| n.is_finite() && n >= 0.0)
                })
            {
                return Err("Google returned invalid query/page metrics.".into());
            }
            let mut result = map_metrics(row)?;
            result["query"] = keys[0].clone();
            result["page"] = keys[1].clone();
            Ok(result)
        })
        .collect::<Result<Vec<_>, _>>()
        .map(|rows| fold_fragment_rows(rows, Some("query")))
}

#[allow(clippy::too_many_arguments)]
pub(super) fn map_performance(
    site_url: &str,
    start: &str,
    end: &str,
    queries: &[Value],
    pages: &[Value],
    totals: &[Value],
    daily: &[Value],
    filters: &GscPerformanceFilters,
    queries_may_be_truncated: bool,
    pages_may_be_truncated: bool,
) -> Result<Value, String> {
    let total = match totals {
        [total] => map_metrics(total)?,
        [] => return Err("Google returned no aggregate Search Console metrics.".into()),
        _ => return Err("Google returned multiple aggregate Search Console rows.".into()),
    };
    let mut daily_rows = daily
        .iter()
        .map(|row| map_analytics_row(row, "date"))
        .collect::<Result<Vec<_>, _>>()?;
    daily_rows.sort_by(|left, right| left["date"].as_str().cmp(&right["date"].as_str()));
    let queries = queries
        .iter()
        .map(|row| map_analytics_row(row, "query"))
        .collect::<Result<Vec<_>, _>>()?;
    let pages = pages
        .iter()
        .map(|row| map_analytics_row(row, "page"))
        .collect::<Result<Vec<_>, _>>()?;
    let pages = fold_fragment_rows(pages, None);
    Ok(json!({
        "site_url": site_url,
        "start_date": start,
        "end_date": end,
        "filters": filters,
        "total_clicks": total["clicks"],
        "total_impressions": total["impressions"],
        "avg_ctr": total["ctr"],
        "avg_position": total["position"],
        "queries": queries,
        "pages": pages,
        "daily": daily_rows,
        "queries_may_be_truncated": queries_may_be_truncated,
        "pages_may_be_truncated": pages_may_be_truncated,
        "daily_may_be_truncated": daily.len() >= SEARCH_ROW_MAX,
        "max_rows_per_dimension": SEARCH_ROW_MAX,
    }))
}
