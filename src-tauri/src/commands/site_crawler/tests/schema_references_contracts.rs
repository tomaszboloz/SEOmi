use super::*;

fn issue(code: &str) -> StructuredDataValidationIssue {
    StructuredDataValidationIssue {
        code: code.into(),
        severity: "warning".into(),
        message: "test".into(),
        path: None,
        recommendation: None,
    }
}

#[test]
fn json_ld_type_collection_accepts_strings_and_graphs_only() {
    let value = serde_json::json!({
        "@type": ["Article", 42, null],
        "@graph": [{"@type": "Person"}, {"name": "no type"}],
        "nested": {"@type": "ignored without graph"}
    });
    let mut types = Vec::new();
    collect_json_ld_types(&value, &mut types);
    assert_eq!(types, vec!["Article", "Person"]);
    collect_json_ld_types(&serde_json::json!(null), &mut types);
    assert_eq!(types.len(), 2);
}

#[test]
fn schema_reference_push_rejects_empty_unsafe_or_oversized_values_and_deduplicates() {
    let mut references = Vec::new();
    push_schema_reference(&mut references, "JSON-LD", 1, "url", "https://example.test");
    push_schema_reference(&mut references, "JSON-LD", 1, "url", "https://example.test");
    push_schema_reference(&mut references, "JSON-LD", 1, "", "value");
    push_schema_reference(&mut references, "JSON-LD", 1, "url", " ");
    push_schema_reference(
        &mut references,
        "JSON-LD",
        1,
        "url",
        &"x".repeat(MAX_SCHEMA_REFERENCE_VALUE_CHARS + 1),
    );
    push_schema_reference(&mut references, "JSON-LD", 1, "url", "line\nfeed");
    assert_eq!(references.len(), 1);
    assert_eq!(references[0].value, "https://example.test");
}

#[test]
fn json_ld_reference_collection_captures_supported_nested_properties() {
    let value = serde_json::json!({
        "@id": "https://example.test/#article",
        "url": "https://example.test/article",
        "sameAs": ["https://social.example/a", {"@id": "https://example.test/#nested"}],
        "mainEntityOfPage": "https://example.test/",
        "isPartOf": {"url": "https://example.test/section"},
        "about": 7,
        "subjectOf": ["https://example.test/video"],
        "author": {"@id": "https://example.test/#author"},
        "publisher": "https://example.test/#publisher",
        "image": "https://example.test/image.png",
        "logo": "https://example.test/logo.png",
        "ignored": {"url": "https://example.test/deep"}
    });
    let mut references = Vec::new();
    collect_json_ld_references(&value, 2, &mut references, 0);
    for (property, expected) in [
        ("@id", "https://example.test/#article"),
        ("url", "https://example.test/article"),
        ("sameAs", "https://social.example/a"),
        ("@id", "https://example.test/#nested"),
        ("mainEntityOfPage", "https://example.test/"),
        ("url", "https://example.test/section"),
        ("subjectOf", "https://example.test/video"),
        ("@id", "https://example.test/#author"),
        ("publisher", "https://example.test/#publisher"),
        ("image", "https://example.test/image.png"),
        ("logo", "https://example.test/logo.png"),
        ("url", "https://example.test/deep"),
    ] {
        assert!(
            references
                .iter()
                .any(|item| item.property == property && item.value == expected),
            "{property} {expected}"
        );
    }
}

#[test]
fn json_ld_reference_collection_obeys_depth_and_reference_limits() {
    let mut too_deep = serde_json::json!({"url": "https://example.test/deep"});
    for _ in 0..17 {
        too_deep = serde_json::json!({"nested": too_deep});
    }
    let mut references = Vec::new();
    collect_json_ld_references(&too_deep, 1, &mut references, 0);
    assert!(references.is_empty());

    let many = serde_json::json!({
        "sameAs": (0..(MAX_SCHEMA_REFERENCES_PER_PAGE + 5))
            .map(|index| format!("https://example.test/{index}"))
            .collect::<Vec<_>>()
    });
    collect_json_ld_references(&many, 1, &mut references, 0);
    assert_eq!(references.len(), MAX_SCHEMA_REFERENCES_PER_PAGE);
}

#[test]
fn schema_findings_append_stops_at_page_limit_and_marks_truncation() {
    let mut output = Vec::new();
    let mut truncated = false;
    let input = (0..(MAX_SCHEMA_FINDINGS_PER_PAGE + 1))
        .map(|index| issue(&format!("issue-{index}")))
        .collect();
    append_schema_findings(input, "JSON-LD", 1, &mut output, &mut truncated);
    assert_eq!(output.len(), MAX_SCHEMA_FINDINGS_PER_PAGE);
    assert!(truncated);
    assert_eq!(output[0].finding.code, "issue-0");
}
