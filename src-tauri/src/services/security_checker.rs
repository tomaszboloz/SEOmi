use crate::models::audit_data::{Issue, IssueCategory, IssueSeverity, SecurityHeaders};
use std::collections::HashMap;

mod core_rules;
#[cfg(test)]
#[path = "security_checker/core_rules_tests.rs"]
mod core_rules_tests;
mod csp_parser;
mod csp_rules;
#[cfg(test)]
#[path = "security_checker/csp_scope_tests.rs"]
mod csp_scope_tests;
#[cfg(test)]
#[path = "security_checker/effective_policy_tests.rs"]
mod effective_policy_tests;
mod policy_rules;
#[cfg(test)]
#[path = "security_checker/policy_tests.rs"]
mod policy_tests;
#[cfg(test)]
mod tests;

pub use core_rules::*;
pub use csp_rules::*;
pub use policy_rules::*;

pub struct SecurityAuditResult {
    pub headers: SecurityHeaders,
    pub issues: Vec<Issue>,
}

/// Evaluates HTTP security headers and produces a security score and actionable issues
pub fn evaluate_security_headers(headers: &HashMap<String, String>) -> SecurityAuditResult {
    evaluate_security_headers_with_repeated(headers, &HashMap::new())
}

pub fn evaluate_security_headers_with_repeated(
    headers: &HashMap<String, String>,
    repeated_headers: &HashMap<String, Vec<String>>,
) -> SecurityAuditResult {
    let mut issues = Vec::new();
    let mut score: u8 = 100;

    let hsts_values = values_for(headers, repeated_headers, "strict-transport-security");
    let csp_values = values_for(headers, repeated_headers, "content-security-policy");
    let report_values = values_for(
        headers,
        repeated_headers,
        "content-security-policy-report-only",
    );
    let referrer_values = values_for(headers, repeated_headers, "referrer-policy");
    let hsts = hsts_values.first().cloned();
    let csp = (!csp_values.is_empty()).then(|| csp_values.join("\n"));
    let report_only = (!report_values.is_empty()).then(|| report_values.join("\n"));
    let x_frame = last_value(headers, repeated_headers, "x-frame-options");
    let x_content_type = last_value(headers, repeated_headers, "x-content-type-options");
    let referrer = effective_referrer_policy(&referrer_values);
    let permissions = last_value(headers, repeated_headers, "permissions-policy")
        .or_else(|| last_value(headers, repeated_headers, "feature-policy"));
    let coop = last_value(headers, repeated_headers, "cross-origin-opener-policy");
    let corp = last_value(headers, repeated_headers, "cross-origin-resource-policy");
    let server = last_value(headers, repeated_headers, "server");
    let x_powered_by = last_value(headers, repeated_headers, "x-powered-by");

    audit_hsts_values(&hsts_values, &mut score, &mut issues);
    if !csp_values.is_empty() || report_values.is_empty() {
        audit_csp_values(&csp_values, &mut score, &mut issues);
    }
    if csp_values.is_empty() && !report_values.is_empty() {
        score = score.saturating_sub(10);
        issues.push(Issue { severity: IssueSeverity::Warning, category: IssueCategory::Security, code: Some("security_csp_report_only".into()), params: None, message: "Only Content-Security-Policy-Report-Only is configured; CSP is not enforced".into(), recommendation: Some("Promote the tested policy to Content-Security-Policy after the rollout is validated".into()) });
    } else if !csp_values.is_empty() && !report_values.is_empty() {
        issues.push(Issue {
            severity: IssueSeverity::Info,
            category: IssueCategory::Security,
            code: Some("security_csp_report_only".into()),
            params: None,
            message: "Content-Security-Policy-Report-Only is also configured".into(),
            recommendation: Some(
                "Review report-only violations before changing the enforced policy".into(),
            ),
        });
    }
    audit_x_frame(x_frame.as_deref(), &mut score, &mut issues);
    audit_x_content_type(x_content_type.as_deref(), &mut score, &mut issues);
    audit_referrer_values(&referrer_values, &mut score, &mut issues);
    audit_permissions(permissions.as_deref(), &mut score, &mut issues);
    audit_information_disclosure(server.as_deref(), x_powered_by.as_deref(), &mut issues);
    audit_cross_origin(coop.as_deref(), &mut issues);

    SecurityAuditResult {
        headers: SecurityHeaders {
            strict_transport_security: hsts,
            content_security_policy: csp,
            content_security_policy_report_only: report_only,
            x_frame_options: x_frame,
            x_content_type_options: x_content_type,
            referrer_policy: referrer,
            permissions_policy: permissions,
            cross_origin_opener_policy: coop,
            cross_origin_resource_policy: corp,
            server,
            x_powered_by,
            repeated_headers: observed_headers(headers, repeated_headers),
            score,
        },
        issues,
    }
}

fn values_for(
    headers: &HashMap<String, String>,
    repeated: &HashMap<String, Vec<String>>,
    name: &str,
) -> Vec<String> {
    repeated
        .get(name)
        .filter(|values| !values.is_empty())
        .cloned()
        .unwrap_or_else(|| headers.get(name).into_iter().cloned().collect())
}

fn last_value(
    headers: &HashMap<String, String>,
    repeated: &HashMap<String, Vec<String>>,
    name: &str,
) -> Option<String> {
    values_for(headers, repeated, name).pop()
}

fn observed_headers(
    headers: &HashMap<String, String>,
    repeated: &HashMap<String, Vec<String>>,
) -> HashMap<String, Vec<String>> {
    if !repeated.is_empty() {
        return repeated.clone();
    }
    headers
        .iter()
        .map(|(name, value)| (name.clone(), vec![value.clone()]))
        .collect()
}
