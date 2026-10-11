pub(super) use super::provider_models::*;
use serde::Serialize;

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Ga4Status {
    Complete,
    Missing,
    Partial,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Ga4StreamEvidence {
    pub(crate) name: String,
    pub(crate) display_name: Option<String>,
    pub(crate) default_uri: String,
    pub(crate) host_name: String,
    pub(crate) measurement_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Ga4Property {
    pub(crate) name: String,
    pub(crate) display_name: Option<String>,
    pub(crate) stream_urls: Vec<String>,
    #[serde(skip)]
    pub(crate) selected_host_name: String,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Ga4Discovery {
    pub(crate) status: Ga4Status,
    pub(crate) property: Option<Ga4Property>,
    pub(crate) account_pages: usize,
    pub(crate) stream_pages: usize,
    pub(crate) candidates_checked: usize,
    pub(crate) may_be_truncated: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Ga4Row {
    pub(crate) landing_page: String,
    pub(crate) host_name: String,
    pub(crate) sessions: f64,
    pub(crate) engaged_sessions: f64,
    pub(crate) key_events: f64,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Ga4Report {
    pub(crate) status: Ga4Status,
    pub(crate) property: String,
    pub(crate) host_name: String,
    pub(crate) start_date: String,
    pub(crate) end_date: String,
    pub(crate) rows: Vec<Ga4Row>,
    pub(crate) row_count: Option<usize>,
    pub(crate) pages: usize,
    pub(crate) may_be_truncated: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Ga4Snapshot {
    pub(crate) status: Ga4Status,
    pub(crate) start_date: String,
    pub(crate) end_date: String,
    pub(crate) discovery: Ga4Discovery,
    pub(crate) report: Option<Ga4Report>,
}
