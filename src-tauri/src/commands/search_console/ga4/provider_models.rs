use serde::Deserialize;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
pub(super) struct AccountPage {
    #[serde(default, rename = "accountSummaries")]
    pub(super) account_summaries: Vec<AccountSummary>,
    #[serde(rename = "nextPageToken")]
    pub(super) next_page_token: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
pub(super) struct AccountSummary {
    #[serde(rename = "propertySummaries", default)]
    pub(super) property_summaries: Vec<PropertySummary>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
pub(super) struct PropertySummary {
    pub(super) property: String,
    #[serde(rename = "displayName")]
    pub(super) display_name: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
pub(super) struct StreamPage {
    #[serde(rename = "dataStreams", default)]
    pub(super) data_streams: Vec<WebDataStream>,
    #[serde(rename = "nextPageToken")]
    pub(super) next_page_token: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
pub(super) struct WebDataStream {
    pub(super) name: Option<String>,
    #[serde(rename = "displayName")]
    pub(super) display_name: Option<String>,
    #[serde(rename = "type")]
    pub(super) stream_type: Option<String>,
    #[serde(rename = "webStreamData")]
    pub(super) web_stream_data: Option<WebStreamData>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
pub(super) struct WebStreamData {
    #[serde(rename = "defaultUri")]
    pub(super) default_uri: Option<String>,
    #[serde(rename = "measurementId")]
    pub(super) measurement_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
pub(super) struct ReportPage {
    #[serde(default, rename = "dimensionHeaders")]
    pub(super) dimension_headers: Vec<NamedField>,
    #[serde(default, rename = "metricHeaders")]
    pub(super) metric_headers: Vec<NamedField>,
    #[serde(default)]
    pub(super) rows: Vec<ReportRow>,
    #[serde(rename = "rowCount")]
    pub(super) row_count: Option<usize>,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
pub(super) struct NamedField {
    pub(super) name: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
pub(super) struct ReportRow {
    #[serde(rename = "dimensionValues", default)]
    pub(super) dimension_values: Vec<DimensionValue>,
    #[serde(rename = "metricValues", default)]
    pub(super) metric_values: Vec<MetricValue>,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
pub(super) struct DimensionValue {
    pub(super) value: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
pub(super) struct MetricValue {
    pub(super) value: Option<String>,
}
