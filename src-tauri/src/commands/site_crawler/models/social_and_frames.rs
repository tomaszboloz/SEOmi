use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledFrame {
    pub src: Option<String>,
    pub resolved_url: Option<String>,
    pub title: Option<String>,
    pub name: Option<String>,
    pub loading: Option<String>,
    pub sandbox: Option<String>,
    #[serde(default)]
    pub checked_in_run: bool,
    #[serde(default)]
    pub http_status: Option<u16>,
    #[serde(default)]
    pub request_error_kind: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CrawledSocialMetaTag {
    pub key: String,
    pub content: Option<String>,
    #[serde(default)]
    pub resource_check: Option<CrawledSocialResourceCheck>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CrawledSocialResourceCheck {
    pub url: String,
    #[serde(default)]
    pub checked_in_run: bool,
    #[serde(default)]
    pub http_status: Option<u16>,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub content_length: Option<u64>,
    #[serde(default)]
    pub intrinsic_width: Option<usize>,
    #[serde(default)]
    pub intrinsic_height: Option<usize>,
    #[serde(default)]
    pub dimensions_source: Option<String>,
    #[serde(default)]
    pub request_error_kind: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledCanonicalTarget {
    pub url: String,
    pub relation: String,
    pub http_status: Option<u16>,
    pub checked_in_run: bool,
}
