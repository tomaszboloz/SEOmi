use crate::models::audit_data::{Issue, IssueCategory, IssueSeverity};
use std::collections::BTreeMap;

pub fn audit_hsts(hsts: Option<&str>, score: &mut u8, issues: &mut Vec<Issue>) {
    if let Some(val) = hsts {
        let val_lower = val.to_lowercase();
        if !val_lower.contains("max-age=") {
            *score = score.saturating_sub(10);
            issues.push(Issue {
                severity: IssueSeverity::Warning,
                category: IssueCategory::Security,
                code: Some("security_hsts_invalid".into()),
                params: None,
                message: "HSTS header is missing 'max-age'".to_string(),
                recommendation: Some(
                    "Specify 'max-age=31536000; includeSubDomains; preload' in Strict-Transport-Security"
                        .to_string(),
                ),
            });
        }
    } else {
        *score = score.saturating_sub(25);
        issues.push(Issue {
            severity: IssueSeverity::Critical,
            category: IssueCategory::Security,
            code: Some("security_hsts_missing".into()),
            params: None,
            message: "Missing Strict-Transport-Security (HSTS) header".to_string(),
            recommendation: Some(
                "Enable HSTS to prevent man-in-the-middle attacks and cookie hijacking".to_string(),
            ),
        });
    }
}

pub fn audit_csp(csp: Option<&str>, score: &mut u8, issues: &mut Vec<Issue>) {
    if let Some(val) = csp {
        let val_lower = val.to_lowercase();
        if val_lower.contains("'unsafe-inline'") || val_lower.contains("'unsafe-eval'") {
            *score = score.saturating_sub(10);
            issues.push(Issue {
                severity: IssueSeverity::Warning,
                category: IssueCategory::Security,
                code: Some("security_csp_unsafe".into()),
                params: None,
                message: "Content-Security-Policy allows 'unsafe-inline' or 'unsafe-eval'".to_string(),
                recommendation: Some(
                    "Avoid unsafe directives in CSP to strictly mitigate Cross-Site Scripting (XSS)"
                        .to_string(),
                ),
            });
        }
    } else {
        *score = score.saturating_sub(25);
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Security,
            code: Some("security_csp_missing".into()),
            params: None,
            message: "Missing Content-Security-Policy (CSP) header".to_string(),
            recommendation: Some(
                "Implement a strict Content-Security-Policy to protect against XSS and data injection"
                    .to_string(),
            ),
        });
    }
}

pub fn audit_x_frame(x_frame: Option<&str>, score: &mut u8, issues: &mut Vec<Issue>) {
    if let Some(val) = x_frame {
        let val_upper = val.to_uppercase();
        if !val_upper.contains("DENY") && !val_upper.contains("SAMEORIGIN") {
            *score = score.saturating_sub(10);
            issues.push(Issue {
                severity: IssueSeverity::Warning,
                category: IssueCategory::Security,
                code: Some("security_xframe_invalid".into()),
                params: Some(BTreeMap::from([("value".into(), val.to_string())])),
                message: format!("X-Frame-Options value '{}' is non-standard", val),
                recommendation: Some(
                    "Set X-Frame-Options to DENY or SAMEORIGIN to prevent Clickjacking".to_string(),
                ),
            });
        }
    } else {
        *score = score.saturating_sub(15);
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Security,
            code: Some("security_xframe_missing".into()),
            params: None,
            message: "Missing X-Frame-Options header (Clickjacking vulnerability)".to_string(),
            recommendation: Some("Set X-Frame-Options to DENY or SAMEORIGIN".to_string()),
        });
    }
}

pub fn audit_x_content_type(x_content_type: Option<&str>, score: &mut u8, issues: &mut Vec<Issue>) {
    if let Some(val) = x_content_type {
        if !val.to_lowercase().contains("nosniff") {
            *score = score.saturating_sub(10);
            issues.push(Issue {
                severity: IssueSeverity::Warning,
                category: IssueCategory::Security,
                code: Some("security_xcontent_invalid".into()),
                params: None,
                message: "X-Content-Type-Options is not set to 'nosniff'".to_string(),
                recommendation: Some(
                    "Set X-Content-Type-Options to 'nosniff' to prevent MIME sniffing attacks"
                        .to_string(),
                ),
            });
        }
    } else {
        *score = score.saturating_sub(15);
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Security,
            code: Some("security_xcontent_missing".into()),
            params: None,
            message: "Missing X-Content-Type-Options header".to_string(),
            recommendation: Some("Add 'X-Content-Type-Options: nosniff' header".to_string()),
        });
    }
}
