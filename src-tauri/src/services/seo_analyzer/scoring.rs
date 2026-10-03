use crate::models::audit_data::{Issue, IssueSeverity};

pub(super) fn calculate_health_score(issues: &[Issue], http_status: u16) -> u8 {
    if http_status >= 400 {
        return 0;
    }

    let mut score: i32 = 100;
    for issue in issues {
        match issue.severity {
            IssueSeverity::Critical => score -= 15,
            IssueSeverity::Warning => score -= 5,
            IssueSeverity::Info => score -= 1,
        }
    }

    score.clamp(0, 100) as u8
}
