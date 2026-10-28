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
    /// H1-H3 sections with text and list/table counts for AI/RAG readiness.
    #[serde(default)]
    pub rag_sections: Vec<RagSection>,
    /// Stable tag/depth skeleton from fetched HTML; omitted when unavailable.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_dom_signature: Option<String>,
    /// Bounded variables explicitly declared by the document; never inferred from URL.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_injected_variables: Option<Vec<String>>,
    /// Explicit TAS subtopic identity, when supplied by the document/report.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tas_subtopic_id: Option<String>,
    /// Thin static HTML that looks like an unrendered SPA shell (Next/Nuxt
    /// payload, empty app root). `None` when the page was not assessed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_js_shell_suspected: Option<bool>,
    /// Which signal triggered `is_js_shell_suspected`; absent when not a shell.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub js_shell_reason: Option<super::JsShellReason>,
    /// Text/title/links parsed from the shell's embedded JSON payload.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spa_payload: Option<super::SpaPayload>,
}

/// One heading-delimited section of main content (AI Overviews / RAG chunking).
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct RagSection {
    /// Heading text; empty for content before the first heading.
    #[serde(default)]
    pub heading: String,
    /// Heading level 1-3; 0 for the lead section.
    #[serde(default)]
    pub level: u8,
    /// Paragraph/list-item texts in document order, bounded.
    #[serde(default)]
    pub paragraphs: Vec<String>,
    #[serde(default)]
    pub tables: u16,
    #[serde(default)]
    pub ordered_lists: u16,
    #[serde(default)]
    pub unordered_lists: u16,
    #[serde(default)]
    pub definition_lists: u16,
    /// Number of tables with a real `thead` or `th`; absent when no table was observed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub table_headers: Option<u16>,
    /// Whether an ordered list has explicit instructional/procedural context.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ordered_list_instruction: Option<bool>,
    /// Word counts for direct `li`/`dd` items; absent when no such items were observed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub list_item_word_counts: Option<Vec<u16>>,
}
