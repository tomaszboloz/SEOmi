use crate::models::audit_data::StructuredDataValidationIssue;
use crate::services::schema_validator::issues::IssueCollector;

fn issue(index: usize) -> StructuredDataValidationIssue {
    StructuredDataValidationIssue {
        code: format!("c{index}"),
        severity: "warning".into(),
        message: "m".into(),
        path: None,
        recommendation: None,
    }
}

#[test]
fn issues_after_the_cap_notice_are_dropped() {
    let mut collector = IssueCollector::default();
    for index in 0..520 {
        collector.push(issue(index));
    }
    let issues = collector.finish(true);
    assert_eq!(issues.len(), 500);
    assert_eq!(issues[499].code, "schema-validation-findings-truncated");
}
