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
    /// Heading-delimited main-content blocks (Information Gain score).
    #[serde(default)]
    pub content_sections: Vec<ContentSection>,
}

/// One heading-delimited block of main content for the Information Gain score.
/// Text is capped, `words` counts the whole block.
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct ContentSection {
    /// Heading text; empty for the intro before the first heading.
    #[serde(default)]
    pub heading: String,
    /// 0 for the intro, otherwise heading level 1-3.
    #[serde(default)]
    pub level: u8,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub words: u32,
    #[serde(default)]
    pub tables: u32,
    #[serde(default)]
    pub lists: u32,
}
