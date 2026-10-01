use super::*;

#[derive(Default)]
pub(super) struct IssueCollector {
    pub(super) issues: Vec<StructuredDataValidationIssue>,
    pub(super) truncated: bool,
}

impl IssueCollector {
    pub(super) fn push(&mut self, issue: StructuredDataValidationIssue) {
        if self.issues.len() < MAX_VALIDATION_ISSUES - 1 && !self.truncated {
            self.issues.push(issue);
        } else if !self.truncated {
            self.issues.push(StructuredDataValidationIssue {
                code: "schema-validation-findings-truncated".into(),
                severity: "info".into(),
                message: format!("Local structured-data findings were capped at {MAX_VALIDATION_ISSUES} to keep the audit bounded."),
                path: None,
                recommendation: Some("Review the source declaration directly; this local report omits findings beyond its safety limit.".into()),
            });
            self.truncated = true;
        }
    }

    pub(super) fn finish(
        mut self,
        traversal_truncated: bool,
    ) -> Vec<StructuredDataValidationIssue> {
        if traversal_truncated && !self.truncated {
            self.push(StructuredDataValidationIssue {
                code: "schema-validation-traversal-truncated".into(),
                severity: "info".into(),
                message:
                    "Local structured-data validation stopped at its node, depth, or type limit."
                        .into(),
                path: None,
                recommendation: Some(
                    "Review the full declaration in the source; not all nested data was validated."
                        .into(),
                ),
            });
        }
        self.issues
    }
}

pub(super) fn issue(
    code: &str,
    severity: &str,
    message: impl Into<String>,
    path: Option<String>,
    recommendation: Option<&str>,
) -> StructuredDataValidationIssue {
    StructuredDataValidationIssue {
        code: code.into(),
        severity: severity.into(),
        message: message.into(),
        path,
        recommendation: recommendation.map(str::to_string),
    }
}
