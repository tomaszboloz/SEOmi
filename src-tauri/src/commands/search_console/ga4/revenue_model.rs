use super::models::Ga4Status;
use serde::{Deserialize, Serialize};
use serde_json::json;

pub(super) const ORGANIC_CHANNEL: &str = "Organic Search";

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Ga4RevenueRow {
    pub(crate) landing_page: String,
    pub(crate) revenue: f64,
}

/// Organic-search revenue per landing page from the GA4 Data API. The currency is the one GA4 reports for
/// the property; a response without it is rejected instead of guessed.
#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Ga4RevenueReport {
    pub(crate) status: Ga4Status,
    pub(crate) property: String,
    pub(crate) host_name: String,
    pub(crate) start_date: String,
    pub(crate) end_date: String,
    pub(crate) currency_code: String,
    pub(crate) attribution: String,
    pub(crate) rows: Vec<Ga4RevenueRow>,
    pub(crate) may_be_truncated: bool,
}

#[derive(Debug, Deserialize)]
pub(super) struct Page {
    #[serde(default)]
    pub(super) rows: Vec<PageRow>,
    #[serde(rename = "rowCount")]
    pub(super) row_count: Option<usize>,
    pub(super) metadata: Option<Metadata>,
}
#[derive(Debug, Deserialize)]
pub(super) struct Metadata {
    #[serde(rename = "currencyCode")]
    pub(super) currency_code: Option<String>,
}
#[derive(Debug, Deserialize)]
pub(super) struct PageRow {
    #[serde(rename = "dimensionValues", default)]
    pub(super) dimensions: Vec<Value>,
    #[serde(rename = "metricValues", default)]
    pub(super) metrics: Vec<Value>,
}
#[derive(Debug, Deserialize)]
pub(super) struct Value {
    pub(super) value: Option<String>,
}

pub(super) fn request(
    start: &str,
    end: &str,
    host: &str,
    offset: usize,
    limit: usize,
) -> serde_json::Value {
    let exact = |field: &str, value: &str| json!({"filter": {"fieldName": field, "stringFilter": {"matchType": "EXACT", "value": value, "caseSensitive": false}}});
    json!({
        "dateRanges": [{"startDate": start, "endDate": end}],
        "dimensions": [{"name": "landingPagePlusQueryString"}, {"name": "hostName"}],
        "metrics": [{"name": "totalRevenue"}],
        "dimensionFilter": {"andGroup": {"expressions": [exact("hostName", host), exact("sessionDefaultChannelGroup", ORGANIC_CHANNEL)]}},
        "offset": offset, "limit": limit
    })
}

pub(super) fn bad(what: &str) -> String {
    format!("Google Analytics returned an invalid revenue {what}.")
}
