use crate::models::audit_data::AmpFinding;

pub(super) const MAX_AMPHTML_TARGETS: usize = 32;
pub(super) const MAX_FINDINGS: usize = 100;
pub(super) const AMP_CUSTOM_CSS_LIMIT_BYTES: usize = 75_000;
pub(super) const MAX_COMPONENTS: usize = 64;

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

pub(super) fn has_amp_noscript_boilerplate(html: &str) -> bool {
    let lower = html.to_ascii_lowercase();
    let mut remainder = lower.as_str();
    while let Some(start) = remainder.find("<noscript") {
        let block = &remainder[start..];
        let end = block.find("</noscript>").unwrap_or(block.len());
        if block[..end].contains("<style") && block[..end].contains("amp-boilerplate") {
            return true;
        }
        if end == block.len() {
            break;
        }
        remainder = &block[end + "</noscript>".len()..];
    }
    false
}
