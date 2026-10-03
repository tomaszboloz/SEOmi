use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IndexabilityAssessment {
    pub status: String,
    pub reasons: Vec<String>,
    pub meta_robots: Option<String>,
    pub x_robots_tag: Option<String>,
    pub canonical: Option<String>,
    pub canonical_matches_final_url: Option<bool>,
    #[serde(default)]
    pub canonical_target_checked: bool,
    #[serde(default)]
    pub canonical_target_status: Option<u16>,
    #[serde(default)]
    pub canonical_target_check_error: Option<String>,
}

impl Default for IndexabilityAssessment {
    fn default() -> Self {
        Self {
            status: "uncertain".to_string(),
            reasons: Vec::new(),
            meta_robots: None,
            x_robots_tag: None,
            canonical: None,
            canonical_matches_final_url: None,
            canonical_target_checked: false,
            canonical_target_status: None,
            canonical_target_check_error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct AccessibilityAudit {
    pub document_language: Option<String>,
    pub landmarks: Vec<AccessibilityLandmark>,
    pub aria_attribute_count: usize,
    pub form_control_count: usize,
    pub unlabeled_form_control_count: usize,
    #[serde(default)]
    pub hidden_form_control_count: usize,
    #[serde(default)]
    pub hidden_form_controls: Vec<AccessibilityElementEvidence>,
    #[serde(default)]
    pub anti_spam_text_control_count: usize,
    #[serde(default)]
    pub anti_spam_text_controls: Vec<AccessibilityElementEvidence>,
    #[serde(default)]
    pub findings: Vec<AccessibilityFinding>,
    pub manual_review_items: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccessibilityFinding {
    pub code: String,
    pub severity: String,
    pub message: String,
    pub evidence: String,
    pub recommendation: String,
    #[serde(default)]
    pub elements: Vec<AccessibilityElementEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccessibilityElementEvidence {
    pub dom_position: usize,
    pub dom_query: String,
    pub html_snippet: String,
    #[serde(default)]
    pub line: Option<usize>,
    #[serde(default)]
    pub column: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccessibilityLandmark {
    pub name: String,
    pub count: usize,
}
