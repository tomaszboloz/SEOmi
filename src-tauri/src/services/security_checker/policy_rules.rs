use crate::models::audit_data::{Issue, IssueCategory, IssueSeverity};
use std::collections::BTreeMap;

const REFERRER_POLICIES: [&str; 8] = [
    "no-referrer",
    "no-referrer-when-downgrade",
    "origin",
    "origin-when-cross-origin",
    "same-origin",
    "strict-origin",
    "strict-origin-when-cross-origin",
    "unsafe-url",
];

pub fn audit_referrer(referrer: Option<&str>, score: &mut u8, issues: &mut Vec<Issue>) {
    let values = referrer.into_iter().map(str::to_owned).collect::<Vec<_>>();
    audit_referrer_values(&values, score, issues);
}

pub fn audit_referrer_values(values: &[String], score: &mut u8, issues: &mut Vec<Issue>) {
    let Some(effective) = effective_referrer_policy(values) else {
        *score = score.saturating_sub(5);
        let (code, message) = if values.is_empty() {
            (
                "security_referrer_missing",
                "Missing Referrer-Policy header",
            )
        } else {
            (
                "security_referrer_invalid",
                "Referrer-Policy contains no valid policy",
            )
        };
        issues.push(Issue {
            severity: IssueSeverity::Info,
            category: IssueCategory::Security,
            code: Some(code.into()),
            params: None,
            message: message.into(),
            recommendation: Some("Set Referrer-Policy to 'strict-origin-when-cross-origin'".into()),
        });
        return;
    };
    if effective == "unsafe-url" {
        *score = score.saturating_sub(5);
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Security,
            code: Some("security_referrer_unsafe".into()),
            params: Some(BTreeMap::from([("value".into(), effective)])),
            message: "Referrer-Policy allows the full URL to be sent cross-origin".into(),
            recommendation: Some(
                "Use strict-origin-when-cross-origin or a stricter Referrer-Policy".into(),
            ),
        });
    }
}

pub fn effective_referrer_policy(values: &[String]) -> Option<String> {
    values
        .iter()
        .flat_map(|value| value.split(','))
        .filter_map(|candidate| {
            let normalized = candidate.trim().to_ascii_lowercase();
            REFERRER_POLICIES
                .contains(&normalized.as_str())
                .then_some(normalized)
        })
        .next_back()
}

pub fn audit_permissions(permissions: Option<&str>, score: &mut u8, issues: &mut Vec<Issue>) {
    if permissions.is_none() {
        *score = score.saturating_sub(5);
        issues.push(Issue {
            severity: IssueSeverity::Info,
            category: IssueCategory::Security,
            code: Some("security_permissions_missing".into()),
            params: None,
            message: "Missing Permissions-Policy header".into(),
            recommendation: Some(
                "Define Permissions-Policy to restrict camera, microphone, geolocation access"
                    .into(),
            ),
        });
    }
}

pub fn audit_information_disclosure(
    server: Option<&str>,
    x_powered_by: Option<&str>,
    issues: &mut Vec<Issue>,
) {
    if let Some(value) = server {
        let has_version = value
            .split('/')
            .nth(1)
            .is_some_and(|part| part.chars().any(|c| c.is_ascii_digit()));
        if has_version {
            issues.push(Issue {
                severity: IssueSeverity::Warning,
                category: IssueCategory::Security,
                code: Some("security_server_version".into()),
                params: Some(BTreeMap::from([("value".into(), value.into())])),
                message: format!("Server header leaks software version ('{value}')"),
                recommendation: Some("Configure web server to suppress banner/version tokens (e.g. ServerTokens Prod in Apache or server_tokens off in nginx)".into()),
            });
        }
    }
    if let Some(value) = x_powered_by {
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Security,
            code: Some("security_powered_by".into()),
            params: Some(BTreeMap::from([("value".into(), value.into())])),
            message: format!("X-Powered-By header discloses technology stack ('{value}')"),
            recommendation: Some("Disable X-Powered-By in your server or framework configuration to reduce information leakage".into()),
        });
    }
}

pub fn audit_cross_origin(coop: Option<&str>, issues: &mut Vec<Issue>) {
    if let Some(value) = coop {
        if !value.to_lowercase().contains("same-origin") {
            issues.push(Issue {
                severity: IssueSeverity::Info,
                category: IssueCategory::Security,
                code: Some("security_coop_relaxed".into()),
                params: Some(BTreeMap::from([("value".into(), value.into())])),
                message: format!("Cross-Origin-Opener-Policy has relaxed setting ('{value}')"),
                recommendation: Some(
                    "Set 'Cross-Origin-Opener-Policy: same-origin' to protect against XS-Leaks"
                        .into(),
                ),
            });
        }
    }
}
