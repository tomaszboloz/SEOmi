use super::*;

pub(in crate::services::html_parser) fn extract_jsonld(document: &Html) -> Vec<StructuredData> {
    let mut list = Vec::new();
    // JSON-LD
    let jsonld_selector = Selector::parse("script[type='application/ld+json']").unwrap();
    for el in document.select(&jsonld_selector) {
        let text = el.text().collect::<Vec<_>>().join("");
        match serde_json::from_str::<serde_json::Value>(&text) {
            Ok(json_val) => {
                let type_str = json_ld_type_summary(&json_val);
                let validation_issues = schema_validator::validate_jsonld(&json_val);
                list.push(StructuredData {
                    data_type: type_str,
                    format: "JSON-LD".to_string(),
                    content: json_val,
                    validation_issues,
                });
            }
            Err(error) => list.push(StructuredData {
                data_type: "Invalid JSON-LD block".to_string(),
                format: "JSON-LD".to_string(),
                content: serde_json::json!({ "parse_error": error.to_string() }),
                validation_issues: vec![crate::models::audit_data::StructuredDataValidationIssue {
                    code: "jsonld-syntax-invalid".into(),
                    severity: "error".into(),
                    message: format!("JSON-LD could not be parsed: {error}"),
                    path: None,
                    recommendation: Some(
                        "Fix the JSON syntax in this script[type=application/ld+json] block."
                            .into(),
                    ),
                }],
            }),
        }
    }

    list
}
