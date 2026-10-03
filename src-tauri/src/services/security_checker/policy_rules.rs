use crate::models::audit_data::{Issue, IssueCategory, IssueSeverity};
use std::collections::BTreeMap;

pub fn audit_referrer(referrer: Option<&str>, score: &mut u8, issues: &mut Vec<Issue>) {
    if referrer.is_none() {
        *score = score.saturating_sub(5);
        issues.push(Issue {
            severity: IssueSeverity::Info,
            category: IssueCategory::Security,
            code: Some("security_referrer_missing".into()),
            params: None,
            message: "Missing Referrer-Policy header".to_string(),
            recommendation: Some(
                "Set Referrer-Policy to 'strict-origin-when-cross-origin'".to_string(),
            ),
        });
    }
}

pub fn audit_permissions(permissions: Option<&str>, score: &mut u8, issues: &mut Vec<Issue>) {
    if permissions.is_none() {
        *score = score.saturating_sub(5);
        issues.push(Issue {
            severity: IssueSeverity::Info,
            category: IssueCategory::Security,
            code: Some("security_permissions_missing".into()),
            params: None,
            message: "Missing Permissions-Policy header".to_string(),
            recommendation: Some(
                "Define Permissions-Policy to restrict camera, microphone, geolocation access"
                    .to_string(),
            ),
        });
    }
}

pub fn audit_information_disclosure(
    server: Option<&str>,
    x_powered_by: Option<&str>,
    issues: &mut Vec<Issue>,
) {
    if let Some(srv) = server {
        let has_version = srv
            .split('/')
            .nth(1)
            .is_some_and(|part| part.chars().any(|c| c.is_ascii_digit()));
        if has_version {
            issues.push(Issue {
                severity: IssueSeverity::Warning,
                category: IssueCategory::Security,
                code: Some("security_server_version".into()),
                params: Some(BTreeMap::from([("value".into(), srv.to_string())])),
                message: format!("Server header leaks software version ('{}')", srv),
                recommendation: Some("Configure web server to suppress banner/version tokens (e.g. ServerTokens Prod in Apache or server_tokens off in nginx)".to_string()),
            });
        }
    }

    if let Some(powered) = x_powered_by {
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Security,
            code: Some("security_powered_by".into()),
            params: Some(BTreeMap::from([("value".into(), powered.to_string())])),
            message: format!("X-Powered-By header discloses technology stack ('{}')", powered),
            recommendation: Some("Disable X-Powered-By in your server or framework configuration to reduce information leakage".to_string()),
        });
    }
}

pub fn audit_cross_origin(coop: Option<&str>, issues: &mut Vec<Issue>) {
    if let Some(val) = coop {
        let val_lower = val.to_lowercase();
        if !val_lower.contains("same-origin") {
            issues.push(Issue {
                severity: IssueSeverity::Info,
                category: IssueCategory::Security,
                code: Some("security_coop_relaxed".into()),
                params: Some(BTreeMap::from([("value".into(), val.to_string())])),
                message: format!("Cross-Origin-Opener-Policy has relaxed setting ('{}')", val),
                recommendation: Some(
                    "Set 'Cross-Origin-Opener-Policy: same-origin' to protect against XS-Leaks"
                        .to_string(),
                ),
            });
        }
    }
}
