use crate::models::audit_data::{Issue, SecurityHeaders};
use std::collections::HashMap;

mod core_rules;
mod policy_rules;
#[cfg(test)]
mod tests;

pub use core_rules::*;
pub use policy_rules::*;

pub struct SecurityAuditResult {
    pub headers: SecurityHeaders,
    pub issues: Vec<Issue>,
}

/// Evaluates HTTP security headers and produces a security score and actionable issues
pub fn evaluate_security_headers(headers: &HashMap<String, String>) -> SecurityAuditResult {
    let mut issues = Vec::new();
    let mut score: u8 = 100;

    let hsts = headers.get("strict-transport-security").cloned();
    let csp = headers.get("content-security-policy").cloned();
    let x_frame = headers.get("x-frame-options").cloned();
    let x_content_type = headers.get("x-content-type-options").cloned();
    let referrer = headers.get("referrer-policy").cloned();
    let permissions = headers
        .get("permissions-policy")
        .or_else(|| headers.get("feature-policy"))
        .cloned();
    let coop = headers.get("cross-origin-opener-policy").cloned();
    let corp = headers.get("cross-origin-resource-policy").cloned();
    let server = headers.get("server").cloned();
    let x_powered_by = headers.get("x-powered-by").cloned();

    audit_hsts(hsts.as_deref(), &mut score, &mut issues);
    audit_csp(csp.as_deref(), &mut score, &mut issues);
    audit_x_frame(x_frame.as_deref(), &mut score, &mut issues);
    audit_x_content_type(x_content_type.as_deref(), &mut score, &mut issues);
    audit_referrer(referrer.as_deref(), &mut score, &mut issues);
    audit_permissions(permissions.as_deref(), &mut score, &mut issues);
    audit_information_disclosure(server.as_deref(), x_powered_by.as_deref(), &mut issues);
    audit_cross_origin(coop.as_deref(), &mut issues);

    SecurityAuditResult {
        headers: SecurityHeaders {
            strict_transport_security: hsts,
            content_security_policy: csp,
            x_frame_options: x_frame,
            x_content_type_options: x_content_type,
            referrer_policy: referrer,
            permissions_policy: permissions,
            cross_origin_opener_policy: coop,
            cross_origin_resource_policy: corp,
            server,
            x_powered_by,
            score,
        },
        issues,
    }
}
