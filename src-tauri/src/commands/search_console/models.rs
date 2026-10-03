use serde::Deserialize;
use serde_json::Value;

pub(super) struct AnalyticsRows {
    pub(super) rows: Vec<Value>,
    pub(super) may_be_truncated: bool,
}

#[derive(Deserialize, Clone, Default, serde::Serialize, PartialEq, Eq)]
pub struct GscPerformanceFilters {
    #[serde(alias = "searchType", skip_serializing_if = "Option::is_none")]
    pub search_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
}
#[derive(Deserialize)]
pub(super) struct TokenResponse {
    pub(super) access_token: Option<String>,
    pub(super) refresh_token: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SitesResponse {
    pub(super) site_entry: Option<Vec<GscSiteProperty>>,
}

#[derive(Deserialize, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GscSiteProperty {
    pub site_url: String,
    pub permission_level: String,
}
