use super::*;
use serde_json::json;

fn question() -> Value {
    json!({"@type":"Question", "name":"Why?", "acceptedAnswer":{"@type":"Answer", "text":"Because."}})
}

fn faq(questions: Vec<Value>) -> Value {
    json!({"@context":"https://schema.org", "@type":"FAQPage", "mainEntity":questions})
}

#[test]
fn faq_profile_reports_truncation_without_validating_entries_beyond_its_limit() {
    let mut questions = vec![question(); MAX_JSONLD_NODES];
    questions.push(json!({"name":""}));
    let issues = validate_jsonld(&faq(questions));
    let truncated = issues
        .iter()
        .find(|issue| issue.code == "faq-questions-truncated")
        .expect("the FAQ profile must report its local validation limit");
    assert_eq!(truncated.severity, "info");
    assert_eq!(truncated.path.as_deref(), Some("$.mainEntity"));
    assert!(truncated.message.contains(&MAX_JSONLD_NODES.to_string()));
    let skipped_path = format!("$.mainEntity[{MAX_JSONLD_NODES}]");
    assert!(!issues.iter().any(|issue| {
        issue.code.starts_with("faq-")
            && issue.path.as_deref().is_some_and(|path| path.starts_with(&skipped_path))
    }));
}

#[test]
fn faq_profile_validates_last_entry_inside_the_limit_without_truncating() {
    let mut questions = vec![question(); MAX_JSONLD_NODES];
    questions[MAX_JSONLD_NODES - 1] = json!({"@type":"Question", "name":"", "acceptedAnswer":null});
    let issues = validate_jsonld(&faq(questions));
    assert!(!issues.iter().any(|issue| issue.code == "faq-questions-truncated"));
    let expected_path = format!("$.mainEntity[{}].name", MAX_JSONLD_NODES - 1);
    assert!(issues.iter().any(|issue| {
        issue.code == "faq-question-name-empty-or-invalid"
            && issue.path.as_deref() == Some(expected_path.as_str())
    }));
}
