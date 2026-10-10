use super::*;

pub(super) fn validate(
    value: &serde_json::Map<String, Value>,
    path: &str,
    issues: &mut IssueCollector,
) {
    let Some(main_entity) = value.get("mainEntity") else {
        return;
    };
    let questions = match main_entity {
        Value::Object(object) => vec![(0, object)],
        Value::Array(items) if !items.is_empty() => {
            let mut objects = Vec::new();
            for (index, item) in items.iter().enumerate() {
                let Some(object) = item.as_object() else {
                    issues.push(issue(
                        "faq-question-shape-invalid",
                        "warning",
                        "FAQPage mainEntity entries should be Question objects in the local profile.",
                        Some(format!("{path}.mainEntity[{index}]")),
                        Some("Use a Question object with name and acceptedAnswer."),
                    ));
                    continue;
                };
                objects.push((index, object));
            }
            objects
        }
        _ => {
            issues.push(issue(
                "faq-main-entity-shape-invalid",
                "warning",
                "FAQPage mainEntity must be a Question object or a non-empty array of Question objects.",
                Some(format!("{path}.mainEntity")),
                Some("Provide one or more Question objects in mainEntity."),
            ));
            Vec::new()
        }
    };
    for (index, question) in &questions {
        let question_path = format!("{path}.mainEntity[{index}]");
        if !question
            .get("@type")
            .and_then(Value::as_str)
            .is_some_and(|kind| type_name(kind).eq_ignore_ascii_case("Question"))
        {
            issues.push(issue(
                "faq-question-type-missing",
                "warning",
                "FAQPage mainEntity entry has no detectable Question @type in the local profile.",
                Some(format!("{question_path}.@type")),
                Some("Set @type to Question for each FAQ entry."),
            ));
        }
        if !non_empty_string_property(question, "name") {
            issues.push(issue(
                "faq-question-name-empty-or-invalid",
                "warning",
                "FAQ Question name must be a non-empty string in the local profile.",
                Some(format!("{question_path}.name")),
                Some("Add the visible question text."),
            ));
        }
        if !question.get("acceptedAnswer").is_some_and(|answer| {
            answer.is_object()
                || answer
                    .as_array()
                    .is_some_and(|items| !items.is_empty() && items.iter().all(Value::is_object))
        }) {
            issues.push(issue(
                "faq-answer-shape-invalid",
                "warning",
                "FAQ Question acceptedAnswer must be a non-empty Answer object or array of objects in the local profile.",
                Some(format!("{question_path}.acceptedAnswer")),
                Some("Provide an Answer object with the visible answer text."),
            ));
        }
    }
}
