use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HeadingsStructure {
    pub h1_count: usize,
    pub h1_texts: Vec<String>,
    pub hierarchy: Vec<HeadingNode>,
    pub has_valid_hierarchy: bool,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HeadingNode {
    pub level: u8,
    pub text: String,
    pub children: Vec<HeadingNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ImageData {
    pub src: String,
    pub alt: Option<String>,
    pub width: Option<String>,
    pub height: Option<String>,
    pub loading: Option<String>,
    pub srcset: Option<String>,
    pub has_alt: bool,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub dimensions_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LinksAnalysis {
    pub total_links: usize,
    pub internal_links: usize,
    pub external_links: usize,
    pub nofollow_links: usize,
    pub links: Vec<LinkData>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LinkData {
    pub href: String,
    pub text: String,
    pub is_internal: bool,
    pub rel: Option<String>,
    pub target: Option<String>,
    #[serde(default)]
    pub is_insecure: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentStats {
    pub word_count: usize,
    pub reading_time_minutes: usize,
    pub text_ratio_percent: f32,
    pub top_keywords: Vec<KeywordStat>,
    #[serde(default)]
    pub sentence_count: usize,
    #[serde(default)]
    pub average_words_per_sentence: f32,
    #[serde(default)]
    pub average_characters_per_word: f32,
    #[serde(default)]
    pub complexity_score: u8,
    #[serde(default)]
    pub complexity_label: String,
    #[serde(default)]
    pub readability_ease_score: f32,
    #[serde(default)]
    pub readability_grade: f32,
    #[serde(default = "default_readability_method")]
    pub readability_method: String,
    #[serde(default)]
    pub readability_label: String,
    #[serde(default)]
    pub body_text: String,
    #[serde(default)]
    pub body_text_truncated: bool,
}

fn default_readability_method() -> String {
    "unavailable".to_string()
}

impl Default for ContentStats {
    fn default() -> Self {
        Self {
            word_count: 0,
            reading_time_minutes: 0,
            text_ratio_percent: 0.0,
            top_keywords: Vec::new(),
            sentence_count: 0,
            average_words_per_sentence: 0.0,
            average_characters_per_word: 0.0,
            complexity_score: 0,
            complexity_label: "unavailable".to_string(),
            readability_ease_score: 0.0,
            readability_grade: 0.0,
            readability_method: "unavailable".to_string(),
            readability_label: "unavailable".to_string(),
            body_text: String::new(),
            body_text_truncated: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KeywordStat {
    pub keyword: String,
    pub count: usize,
    #[serde(default)]
    pub density_percent: f32,
}
