use serde::{Deserialize, Serialize};

/// One weighted n-gram of a page for the Site Focus Score engine.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct FocusTerm {
    /// Folded, lemmatized key (same keying as `semantic_term_key`).
    pub term: String,
    /// Most frequent surface form on the page.
    pub surface: String,
    /// Raw occurrences, not zone weighted.
    pub count: u32,
    /// Zone weighted occurrences (title/H1 x2.5, H2-H3 x1.5, body x1).
    pub weight: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct HeadingTexts {
    #[serde(default)]
    pub h1: Vec<String>,
    #[serde(default)]
    pub h2: Vec<String>,
    #[serde(default)]
    pub h3: Vec<String>,
}

/// Page data consumed by the Site Focus Score engine. Flattened into
/// `CrawledPageSummary`; every field defaults so older saved runs still load.
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct CrawledPageFocus {
    #[serde(default)]
    pub focus_terms: Vec<FocusTerm>,
    #[serde(default)]
    pub heading_texts: HeadingTexts,
    /// Characters of cleaned main-content text the focus terms came from.
    #[serde(default)]
    pub focus_text_chars: u32,
    /// Latest `YYYY-MM-DD` date the page declares (modified, else published;
    /// falls back to the HTTP `Last-Modified` header). Feeds topical freshness.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_date: Option<String>,
}
