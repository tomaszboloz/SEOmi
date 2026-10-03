use serde::{Deserialize, Serialize};

pub const MAX_CUSTOM_SEARCHES: usize = 10;
pub const MAX_CUSTOM_SEARCH_CHARS_PER_RUN: usize = 64_000;
pub const MAX_MATCHES_PER_SEARCH: usize = 5;
pub const MAX_VALUE_CHARS: usize = 1_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CustomSearchDefinition {
    pub id: String,
    pub name: String,
    pub selector_type: String,
    pub query: String,
    pub result_type: String,
    #[serde(default)]
    pub attribute: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CrawledCustomSearchResult {
    pub id: String,
    pub values: Vec<String>,
    pub error: Option<String>,
    pub truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum XPathTerminal {
    Element,
    Text,
    Attribute(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct XPathSelector {
    pub css: String,
    pub terminal: XPathTerminal,
    pub text_match: Option<XPathTextMatch>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum XPathTextMatch {
    Contains(String),
    ContainsNormalized(String),
    Equals(String),
    EqualsNormalized(String),
}

pub struct ParsedXPathStep<'a> {
    pub tag: &'a str,
    pub css_predicates: Vec<String>,
    pub text_match: Option<XPathTextMatch>,
}

pub enum XPathPredicate {
    Css(String),
    TextMatch(XPathTextMatch),
}
