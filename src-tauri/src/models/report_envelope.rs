use serde::{Deserialize, Serialize};

/// Wire contract shared with `src/services/analysisContracts` (#85 GEM-85-T01). Rust emits it, TypeScript,
/// the MCP server and PDF export read it. Unknown stays `None`, never a fabricated 0.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Availability {
    pub status: String,
    pub reason: Option<String>,
    pub coverage: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportEnvelope {
    pub contract_version: u32,
    pub project_id: String,
    pub run_id: Option<String>,
    pub module: String,
    pub algorithm_version: u32,
    pub profile_id: Option<String>,
    pub model_id: Option<String>,
    pub content_hash: Option<String>,
    pub generated_at: String,
    pub availability: Availability,
    pub value: Option<serde_json::Value>,
}

impl ReportEnvelope {
    /// A value may travel only with a status that still vouches for it.
    pub fn is_consistent(&self) -> bool {
        let keeps = matches!(self.availability.status.as_str(), "complete" | "partial" | "stale");
        keeps || self.value.is_none()
    }
}

#[cfg(test)]
#[path = "report_envelope_tests.rs"]
mod tests;
