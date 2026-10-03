use crate::models::audit_data::{AmpAudit, Issue, IssueCategory, IssueSeverity, StructuredData};
use std::collections::BTreeMap;

pub fn collect_structured_data_issues(structured_data: &[StructuredData]) -> Vec<Issue> {
    let mut issues = Vec::new();
    for item in structured_data {
        for validation in &item.validation_issues {
            issues.push(Issue {
                severity: match validation.severity.as_str() {
                    "info" => IssueSeverity::Info,
                    // Invalid structured data is a warning for the document, not an HTTP failure.
                    "error" | "warning" => IssueSeverity::Warning,
                    _ => IssueSeverity::Info,
                },
                category: IssueCategory::StructuredData,
                code: Some("structured_validation".into()),
                params: Some(BTreeMap::from([
                    ("format".into(), item.format.clone()),
                    ("type".into(), item.data_type.clone()),
                    ("detail".into(), validation.message.clone()),
                ])),
                message: format!(
                    "{} ({}): {}",
                    item.format, item.data_type, validation.message
                ),
                recommendation: validation.recommendation.clone(),
            });
        }
    }
    issues
}

pub fn collect_amp_issues(amp: &AmpAudit) -> Vec<Issue> {
    let mut issues = Vec::new();
    for finding in &amp.findings {
        issues.push(Issue {
            severity: match finding.severity.as_str() {
                "error" => IssueSeverity::Critical,
                "warning" => IssueSeverity::Warning,
                _ => IssueSeverity::Info,
            },
            category: IssueCategory::Technical,
            code: Some(format!("amp_{}", finding.code)),
            params: Some(BTreeMap::from([
                ("detail".into(), finding.message.clone()),
                ("finding_code".into(), finding.code.clone()),
            ])),
            message: format!("AMP: {} [{}]", finding.message, finding.code),
            recommendation: Some(finding.recommendation.clone()),
        });
    }
    issues
}
