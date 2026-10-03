use crate::models::audit_data::AmpFinding;
const MAX_FINDINGS: usize = 100;

pub(super) fn add_finding(
    findings: &mut Vec<AmpFinding>,
    code: &str,
    severity: &str,
    message: String,
    evidence: String,
    recommendation: &str,
) {
    if findings.len() < MAX_FINDINGS {
        findings.push(AmpFinding {
            code: code.to_string(),
            severity: severity.to_string(),
            message,
            evidence,
            recommendation: recommendation.to_string(),
        });
    }
}
