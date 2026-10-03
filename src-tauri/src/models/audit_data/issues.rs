use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Issue {
    pub severity: IssueSeverity,
    pub category: IssueCategory,
    /// Stable identifier used by the desktop UI to localize persisted findings.
    /// Older audit records omit this field and are rendered from their legacy
    /// message/recommendation values.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    /// Interpolation values for the localized message/recommendation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub params: Option<BTreeMap<String, String>>,
    pub message: String,
    pub recommendation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum IssueSeverity {
    Critical,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum IssueCategory {
    MetaTags,
    OpenGraph,
    TwitterCard,
    Headings,
    Images,
    Links,
    Security,
    Performance,
    Technical,
    StructuredData,
}
