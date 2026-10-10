use crate::models::audit_data::{Issue, IssueCategory, IssueSeverity};

const HSTS_MIN_SECONDS: u64 = 15_552_000;

enum HstsMaxAge {
    Missing,
    Invalid,
    Value(u64),
}

pub fn audit_hsts(hsts: Option<&str>, score: &mut u8, issues: &mut Vec<Issue>) {
    audit_hsts_values(
        hsts.into_iter()
            .map(str::to_owned)
            .collect::<Vec<_>>()
            .as_slice(),
        score,
        issues,
    );
}

pub fn audit_hsts_values(values: &[String], score: &mut u8, issues: &mut Vec<Issue>) {
    if values.is_empty() {
        *score = score.saturating_sub(25);
        issues.push(issue(
            IssueSeverity::Critical,
            "security_hsts_missing",
            "Missing Strict-Transport-Security (HSTS) header",
            "Enable HSTS to prevent man-in-the-middle attacks and cookie hijacking",
        ));
        return;
    }
    // Browsers process the first HSTS field. Keep later fields as evidence but
    // never let a duplicate hide a malformed first policy.
    let value = &values[0];
    let max_age = match hsts_max_age(value) {
        HstsMaxAge::Value(max_age) => max_age,
        HstsMaxAge::Missing => {
            *score = score.saturating_sub(10);
            issues.push(issue(IssueSeverity::Warning, "security_hsts_invalid", "HSTS header is missing 'max-age'", "Specify 'max-age=31536000; includeSubDomains; preload' in Strict-Transport-Security"));
            return;
        }
        HstsMaxAge::Invalid => {
            *score = score.saturating_sub(10);
            issues.push(issue(
                IssueSeverity::Warning,
                "security_hsts_invalid",
                "HSTS header has an invalid 'max-age'",
                "Specify a non-negative numeric max-age in Strict-Transport-Security",
            ));
            return;
        }
    };
    if max_age == 0 {
        *score = score.saturating_sub(20);
        issues.push(issue(
            IssueSeverity::Warning,
            "security_hsts_disabled",
            "HSTS is disabled by 'max-age=0'",
            "Use a positive HSTS max-age of at least six months",
        ));
    } else if max_age < HSTS_MIN_SECONDS {
        *score = score.saturating_sub(10);
        issues.push(issue(
            IssueSeverity::Warning,
            "security_hsts_short",
            "HSTS max-age is shorter than six months",
            "Use an HSTS max-age of at least 15552000 seconds",
        ));
    }
}

fn hsts_max_age(value: &str) -> HstsMaxAge {
    let mut max_age: Option<u64> = None;
    for directive in value.split(';') {
        let Some((name, raw)) = directive.trim().split_once('=') else {
            continue;
        };
        if name.trim().eq_ignore_ascii_case("max-age") {
            if max_age.is_some() {
                return HstsMaxAge::Invalid;
            }
            max_age = Some(match raw.trim().parse() {
                Ok(value) => value,
                Err(_) => return HstsMaxAge::Invalid,
            });
        }
    }
    max_age.map_or(HstsMaxAge::Missing, HstsMaxAge::Value)
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

pub fn audit_x_frame(x_frame: Option<&str>, score: &mut u8, issues: &mut Vec<Issue>) {
    if let Some(value) = x_frame {
        let upper = value.to_uppercase();
        if !upper.contains("DENY") && !upper.contains("SAMEORIGIN") {
            *score = score.saturating_sub(10);
            issues.push(issue(
                IssueSeverity::Warning,
                "security_xframe_invalid",
                &format!("X-Frame-Options value '{value}' is non-standard"),
                "Set X-Frame-Options to DENY or SAMEORIGIN to prevent Clickjacking",
            ));
        }
    } else {
        *score = score.saturating_sub(15);
        issues.push(issue(
            IssueSeverity::Warning,
            "security_xframe_missing",
            "Missing X-Frame-Options header (Clickjacking vulnerability)",
            "Set X-Frame-Options to DENY or SAMEORIGIN",
        ));
    }
}

pub fn audit_x_content_type(value: Option<&str>, score: &mut u8, issues: &mut Vec<Issue>) {
    if value.is_some_and(|value| value.to_lowercase().contains("nosniff")) {
        return;
    }
    *score = score.saturating_sub(if value.is_some() { 10 } else { 15 });
    let (code, message) = if value.is_some() {
        (
            "security_xcontent_invalid",
            "X-Content-Type-Options is not set to 'nosniff'",
        )
    } else {
        (
            "security_xcontent_missing",
            "Missing X-Content-Type-Options header",
        )
    };
    issues.push(issue(
        IssueSeverity::Warning,
        code,
        message,
        "Set X-Content-Type-Options to 'nosniff' to prevent MIME sniffing attacks",
    ));
}
