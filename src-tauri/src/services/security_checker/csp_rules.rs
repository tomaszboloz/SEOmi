use super::csp_parser::parse_csp;
use crate::models::audit_data::{Issue, IssueCategory, IssueSeverity};

pub fn audit_csp(csp: Option<&str>, score: &mut u8, issues: &mut Vec<Issue>) {
    let values = csp.into_iter().map(str::to_owned).collect::<Vec<_>>();
    audit_csp_values(&values, score, issues);
}

pub fn audit_csp_values(values: &[String], score: &mut u8, issues: &mut Vec<Issue>) {
    if values.is_empty() {
        *score = score.saturating_sub(25);
        issues.push(issue(
            IssueSeverity::Warning,
            "security_csp_missing",
            "Missing Content-Security-Policy (CSP) header",
            "Implement a strict Content-Security-Policy to protect against XSS and data injection",
        ));
        return;
    }
    let policies = values
        .iter()
        .map(|value| parse_csp(value))
        .collect::<Vec<_>>();
    if policies.iter().all(|policy| !policy.has_script_fallback()) {
        *score = score.saturating_sub(10);
        issues.push(issue(
            IssueSeverity::Warning,
            "security_csp_script_scope_missing",
            "CSP has neither 'default-src' nor 'script-src'",
            "Define default-src or script-src so injected scripts have no implicit allow-all policy",
        ));
    }
    if policies.iter().all(|policy| !policy.has_script_fallback()) {
        return;
    }
    for (token, code, message) in [
        (
            "'unsafe-inline'",
            "security_csp_unsafe",
            "Content-Security-Policy allows 'unsafe-inline'",
        ),
        (
            "'unsafe-eval'",
            "security_csp_unsafe",
            "Content-Security-Policy allows 'unsafe-eval'",
        ),
        (
            "*",
            "security_csp_wildcard",
            "Content-Security-Policy allows a wildcard script source",
        ),
        (
            "data:",
            "security_csp_data_script",
            "Content-Security-Policy allows data: script sources",
        ),
    ] {
        if policies.iter().all(|policy| policy.allows(token)) {
            *score = score.saturating_sub(10);
            issues.push(issue(
                IssueSeverity::Warning,
                code,
                message,
                "Restrict script sources to trusted origins and nonces or hashes",
            ));
        }
    }
}

fn issue(severity: IssueSeverity, code: &str, message: &str, recommendation: &str) -> Issue {
    Issue {
        severity,
        category: IssueCategory::Security,
        code: Some(code.into()),
        params: None,
        message: message.into(),
        recommendation: Some(recommendation.into()),
    }
}
