use super::*;
use serde_json::json;

fn faq_issues(entity: Value) -> Vec<StructuredDataValidationIssue> {
    validate_jsonld(
        &json!({"@context":"https://schema.org", "@type":"FAQPage", "mainEntity":entity}),
    )
    .into_iter()
    .filter(|issue| issue.code.starts_with("faq-"))
    .collect()
}

#[test]
fn faq_diagnostics_preserve_source_indices_after_invalid_entries() {
    let issues = faq_issues(json!([null, {"@type":"Question","name":"", "acceptedAnswer":null}]));
    for (code, path) in [
        ("faq-question-shape-invalid", "$.mainEntity[0]"),
        ("faq-question-name-empty-or-invalid", "$.mainEntity[1].name"),
        ("faq-answer-shape-invalid", "$.mainEntity[1].acceptedAnswer"),
    ] {
        assert!(
            issues
                .iter()
                .any(|issue| issue.code == code && issue.path.as_deref() == Some(path)),
            "missing {code} at {path}: {issues:?}"
        );
    }
}

#[test]
fn faq_accepts_single_question_and_non_empty_answer_object_arrays() {
    let question = json!({"@type":"https://schema.org/Question","name":"Why?", "acceptedAnswer":{"@type":"Answer","text":"Because."}});
    assert!(faq_issues(question.clone()).is_empty());
    let mut array_answer = question.clone();
    array_answer["acceptedAnswer"] =
        json!([{"@type":"Answer", "text":"One."}, {"@type":"Answer","text":"Two."}]);
    assert!(faq_issues(json!([question, array_answer])).is_empty());
}

#[test]
fn faq_rejects_empty_entities_and_invalid_answer_shapes() {
    for entity in [json!([]), json!(null), json!("Question")] {
        let issues = faq_issues(entity);
        assert!(issues
            .iter()
            .any(|issue| issue.code == "faq-main-entity-shape-invalid"
                && issue.path.as_deref() == Some("$.mainEntity")));
    }
    for answer in [json!([]), json!([null]), json!(false), json!("Answer")] {
        let issues =
            faq_issues(json!({"@type":"Question", "name":"Why?", "acceptedAnswer":answer}));
        assert!(issues
            .iter()
            .any(|issue| issue.code == "faq-answer-shape-invalid"
                && issue.path.as_deref() == Some("$.mainEntity[0].acceptedAnswer")));
    }
}
