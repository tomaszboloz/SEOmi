use super::*;
use serde_json::json;

fn breadcrumb_issues(items: Value) -> Vec<StructuredDataValidationIssue> {
    validate_jsonld(&json!({
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": items
    }))
    .into_iter()
    .filter(|issue| issue.code.starts_with("breadcrumb-"))
    .collect()
}

#[test]
fn breadcrumb_empty_and_non_object_entries_have_precise_diagnostics() {
    let empty = breadcrumb_issues(json!([]));
    assert!(empty
        .iter()
        .any(|issue| issue.code == "breadcrumb-items-empty"
            && issue.path.as_deref() == Some("$.itemListElement")));
    let invalid = breadcrumb_issues(json!([null, "Home", 3]));
    let paths = invalid
        .iter()
        .filter(|issue| issue.code == "breadcrumb-list-item-invalid")
        .map(|issue| issue.path.as_deref().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(
        paths,
        vec![
            "$.itemListElement[0]",
            "$.itemListElement[1]",
            "$.itemListElement[2]"
        ]
    );
}

#[test]
fn breadcrumb_positive_numeric_and_string_positions_accept_schema_types() {
    let issues = breadcrumb_issues(json!([
        {"@type":"ListItem", "position":1, "name":"Home"},
        {"@type":"https://schema.org/ListItem", "position":"2", "name":"Product"},
        {"@type":"listitem", "position":3, "name":"Details"}
    ]));
    assert!(issues.is_empty(), "{issues:?}");
}

#[test]
fn breadcrumb_invalid_positions_types_and_names_are_reported_per_entry() {
    for position in [
        json!(0),
        json!(-1),
        json!(1.5),
        json!("0"),
        json!("no"),
        json!(null),
    ] {
        let issues = breadcrumb_issues(json!([{"@type":null,"position":position,"name":"  "}]));
        for (code, suffix) in [
            ("breadcrumb-position-invalid", "position"),
            ("breadcrumb-list-item-type-missing", "@type"),
            ("breadcrumb-name-empty-or-invalid", "name"),
        ] {
            let expected = format!("$.itemListElement[0].{suffix}");
            assert!(issues.iter().any(
                |issue| issue.code == code && issue.path.as_deref() == Some(expected.as_str())
            ));
        }
    }
}

#[test]
fn breadcrumb_oversized_list_reports_the_local_validation_limit() {
    let entry = json!({"@type":"ListItem", "position":1, "name":"Home"});
    let issues = breadcrumb_issues(json!(vec![entry; MAX_JSONLD_NODES + 1]));
    let truncated = issues
        .iter()
        .find(|issue| issue.code == "breadcrumb-list-truncated")
        .unwrap();
    assert_eq!(truncated.severity, "info");
    assert_eq!(truncated.path.as_deref(), Some("$.itemListElement"));
    assert!(truncated.message.contains(&MAX_JSONLD_NODES.to_string()));
}
