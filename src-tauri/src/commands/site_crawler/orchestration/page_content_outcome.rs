use super::*;

pub struct PageContentOutcome {
    pub document_language: Option<String>,
    pub word_count: usize,
    pub content_hash: Option<String>,
    pub text_ratio_percent: Option<f64>,
    pub reading_time_minutes: Option<usize>,
    pub content_simhash: Option<String>,
    pub semantic_terms: Vec<String>,
    pub semantic_language: Option<String>,
    pub semantic_excerpts: Vec<String>,
    pub focus: CrawledPageFocus,
    pub has_primary_content_root: bool,
    pub semantic_content_source: String,
    pub title: Option<String>,
    pub title_length: Option<usize>,
    pub h1_count: usize,
    pub heading_counts: Vec<usize>,
    pub duplicate_headings: Vec<CrawledDuplicateHeading>,
    pub meta_description: Option<String>,
    pub meta_description_length: Option<usize>,
}
