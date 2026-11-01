use super::{models::Ga4Status, revenue_model::ORGANIC_CHANNEL, validation::REPORT_PAGE_SIZE};
use serde::Serialize;
use serde_json::json;

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Ga4DailyRow {
    pub(crate) date: String,
    pub(crate) key_events: f64,
    pub(crate) revenue: f64,
}

/// Daily organic-search outcomes for the whole site or one landing page (#97): key events and revenue.
#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Ga4DailyReport {
    pub(crate) status: Ga4Status,
    pub(crate) property: String,
    pub(crate) host_name: String,
    pub(crate) page_path: Option<String>,
    pub(crate) start_date: String,
    pub(crate) end_date: String,
    pub(crate) currency_code: String,
    pub(crate) daily: Vec<Ga4DailyRow>,
    pub(crate) may_be_truncated: bool,
}

pub(super) fn bad(what: &str) -> String {
    format!("Google Analytics returned an invalid daily {what}.")
}

pub(super) fn exact(field: &str, kind: &str, value: &str) -> serde_json::Value {
    json!({"filter": {"fieldName": field, "stringFilter": {"matchType": kind, "value": value, "caseSensitive": false}}})
}

pub(super) fn request(start: &str, end: &str, host: &str, page: Option<&str>) -> serde_json::Value {
    let mut filters = vec![
        exact("hostName", "EXACT", host),
        exact("sessionDefaultChannelGroup", "EXACT", ORGANIC_CHANNEL),
    ];
    if let Some(path) = page {
        filters.push(exact("landingPagePlusQueryString", "BEGINS_WITH", path));
    }
    json!({
        "dateRanges": [{"startDate": start, "endDate": end}],
        "dimensions": [{"name": "date"}],
        "metrics": [{"name": "keyEvents"}, {"name": "totalRevenue"}],
        "dimensionFilter": {"andGroup": {"expressions": filters}},
        "orderBys": [{"dimension": {"dimensionName": "date"}}],
        "limit": REPORT_PAGE_SIZE
    })
}

pub(super) fn iso_date(raw: &str) -> Option<String> {
    (raw.len() == 8 && raw.bytes().all(|b| b.is_ascii_digit()))
        .then(|| format!("{}-{}-{}", &raw[..4], &raw[4..6], &raw[6..]))
}

pub(super) fn page_path(value: Option<String>) -> Result<Option<String>, String> {
    match value.map(|path| path.trim().to_owned()) {
        None => Ok(None),
        Some(path)
            if path.starts_with('/')
                && path.len() <= 512
                && !path.contains(char::is_whitespace) =>
        {
            Ok(Some(path))
        }
        Some(_) => Err("Google Analytics page path is invalid.".into()),
    }
}
