use super::*;

pub fn validate_rdfa(content: &Value) -> Vec<StructuredDataValidationIssue> {
    let mut issues = IssueCollector::default();
    let vocab = content
        .get("vocab")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if !vocab.is_empty() && !Url::parse(vocab).is_ok_and(|url| !url.scheme().is_empty()) {
        issues.push(issue(
            "rdfa-vocab-not-absolute",
            "error",
            "RDFa vocab is not an absolute IRI.",
            Some("vocab".into()),
            Some("Set vocab to an absolute vocabulary IRI."),
        ));
    } else if !vocab.is_empty() && !schema_org_iri(vocab) {
        issues.push(issue(
            "rdfa-non-schema-vocabulary",
            "info",
            "RDFa declares a vocabulary outside Schema.org; its terms are not validated by this local ruleset.",
            Some("vocab".into()),
            None,
        ));
    }
    for field in [
        "typeof", "property", "rel", "rev", "prefix", "datatype", "content",
    ] {
        if content.get(field).is_some_and(|value| !value.is_null())
            && content.get(field).and_then(Value::as_str).is_none()
        {
            issues.push(issue(
                "rdfa-term-shape-invalid",
                "error",
                format!("RDFa {field} must contain a string of terms."),
                Some(field.into()),
                Some("Use space-separated CURIEs or absolute IRIs."),
            ));
        } else if content
            .get(field)
            .and_then(Value::as_str)
            .is_some_and(|value| value.trim().is_empty())
        {
            issues.push(issue(
                "rdfa-term-empty",
                "warning",
                format!("RDFa {field} is declared but contains no term."),
                Some(field.into()),
                Some("Remove the empty attribute or provide a non-empty term."),
            ));
        }
    }
    issues.finish(false)
}
