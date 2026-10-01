use crate::models::audit_data::{Issue, IssueCategory, IssueSeverity};

pub(super) fn audit_accessibility(
    audit: &crate::models::audit_data::AccessibilityAudit,
) -> Vec<Issue> {
    audit
        .findings
        .iter()
        .map(|finding| {
            // Evidence arrays are deliberately capped. Keep the original
            // finding count in params so localized Overview text does not
            // report the cap (for example 50) as the real problem count.
            let finding_count = finding
                .message
                .split_whitespace()
                .find_map(|token| {
                    token
                        .trim_matches(|character: char| !character.is_ascii_digit())
                        .parse::<usize>()
                        .ok()
                })
                .unwrap_or(finding.elements.len());
            let mut params = std::collections::BTreeMap::from([
                ("message".into(), finding.message.clone()),
                ("recommendation".into(), finding.recommendation.clone()),
                ("count".into(), finding_count.to_string()),
            ]);
            match finding.code.as_str() {
                "accessibility-form-controls-unlabeled" => {
                    params.insert(
                        "unlabeled".into(),
                        audit.unlabeled_form_control_count.to_string(),
                    );
                    params.insert("total".into(), audit.form_control_count.to_string());
                }
                "accessibility-document-language-invalid" => {
                    params.insert(
                        "value".into(),
                        finding
                            .evidence
                            .strip_prefix("lang=")
                            .unwrap_or(&finding.evidence)
                            .to_string(),
                    );
                }
                "accessibility-duplicate-id"
                | "accessibility-aria-reference-unresolved"
                | "accessibility-interactive-name-missing" => {
                    params.insert("value".into(), finding.evidence.clone());
                }
                _ => {}
            }
            Issue {
                severity: match finding.severity.as_str() {
                    "error" => IssueSeverity::Critical,
                    "warning" => IssueSeverity::Warning,
                    _ => IssueSeverity::Info,
                },
                category: IssueCategory::Technical,
                code: Some(finding.code.clone()),
                params: Some(params),
                message: format!("Dostępność · {}: {}", finding.code, finding.message),
                recommendation: Some(if finding.elements.is_empty() {
                    finding.recommendation.clone()
                } else {
                    let locations = finding
                        .elements
                        .iter()
                        .take(5)
                        .map(|element| format!("#{} {}", element.dom_position, element.dom_query))
                        .collect::<Vec<_>>()
                        .join("; ");
                    let remaining = finding.elements.len().saturating_sub(5);
                    let suffix = if remaining > 0 {
                        format!("; jeszcze {remaining} w Szczegółach dostępności")
                    } else {
                        "; fragmenty HTML są w Szczegółach dostępności".to_string()
                    };
                    format!(
                        "{} Lokalizacje w DOM: {}{}",
                        finding.recommendation, locations, suffix
                    )
                }),
            }
        })
        .collect()
}
