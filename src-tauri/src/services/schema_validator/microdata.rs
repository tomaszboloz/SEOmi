use super::*;

pub fn validate_microdata(content: &Value) -> Vec<StructuredDataValidationIssue> {
    let mut issues = IssueCollector::default();
    let Some(item_type) = content.get("itemtype").and_then(Value::as_str) else {
        issues.push(issue(
            "microdata-itemtype-missing",
            "error",
            "An itemscope element has no itemtype.",
            Some("itemtype".into()),
            Some("Add an absolute itemtype IRI to the itemscope element."),
        ));
        return issues.finish(false);
    };
    let types = item_type.split_ascii_whitespace().collect::<Vec<_>>();
    if types.is_empty() {
        issues.push(issue(
            "microdata-itemtype-empty",
            "error",
            "Microdata itemtype is empty.",
            Some("itemtype".into()),
            Some("Add one or more absolute itemtype IRIs."),
        ));
    }
    let mut properties = HashSet::new();
    if let Some(values) = content.get("itemprops").and_then(Value::as_array) {
        for (index, value) in values.iter().enumerate() {
            let Some(value) = value
                .as_str()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            else {
                issues.push(issue(
                    "microdata-itemprop-invalid",
                    "error",
                    "Every Microdata itemprop entry must be a non-empty string.",
                    Some(format!("itemprops[{index}]")),
                    Some("Use one or more non-empty property names on itemprop."),
                ));
                continue;
            };
            let normalized = value.to_ascii_lowercase();
            if !properties.insert(normalized) {
                issues.push(issue(
                    "microdata-itemprop-duplicate",
                    "warning",
                    format!("Microdata itemprop `{value}` is declared more than once on this itemscope."),
                    Some(format!("itemprops[{index}]")),
                    Some("Keep each property declaration once per extracted itemscope."),
                ));
            }
        }
    }
    if let Some(itemid) = content.get("itemid").and_then(Value::as_str) {
        let itemid = itemid.trim();
        if !itemid.is_empty()
            && !Url::parse(itemid).is_ok_and(|url| !url.scheme().is_empty() && url.has_host())
        {
            issues.push(issue(
                "microdata-itemid-not-absolute",
                "error",
                "Microdata itemid must be an absolute URL when it is declared.",
                Some("itemid".into()),
                Some("Use an absolute identifier URL together with itemtype."),
            ));
        }
    }
    if let Some(values) = content.get("itemref").and_then(Value::as_array) {
        let mut references = HashSet::new();
        for (index, value) in values.iter().enumerate() {
            let Some(value) = value
                .as_str()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            else {
                issues.push(issue(
                    "microdata-itemref-invalid",
                    "error",
                    "Every Microdata itemref entry must be a non-empty element ID.",
                    Some(format!("itemref[{index}]")),
                    Some("Use space-separated IDs of elements that extend this itemscope."),
                ));
                continue;
            };
            if !references.insert(value.to_string()) {
                issues.push(issue(
                    "microdata-itemref-duplicate",
                    "warning",
                    format!("Microdata itemref `{value}` is repeated."),
                    Some(format!("itemref[{index}]")),
                    Some("Keep each referenced element ID once."),
                ));
            }
        }
    }
    for (index, value) in types.iter().enumerate() {
        let path = format!("itemtype[{index}]");
        let valid_absolute_iri =
            Url::parse(value).is_ok_and(|url| !url.scheme().is_empty() && url.has_host());
        if !valid_absolute_iri {
            issues.push(issue(
                "microdata-itemtype-not-absolute",
                "error",
                format!("Microdata itemtype `{value}` is not an absolute URL IRI."),
                Some(path.clone()),
                Some("Use an absolute vocabulary URL, for example https://schema.org/Product."),
            ));
        } else if !schema_org_iri(value) {
            issues.push(issue(
                "microdata-non-schema-vocabulary",
                "info",
                format!("Microdata itemtype `{value}` is outside Schema.org; its vocabulary is not validated by this local ruleset."),
                Some(path.clone()),
                None,
            ));
        }
        if schema_org_iri(value) {
            validate_profile(value, &properties, &path, &mut issues);
        }
    }
    issues.finish(false)
}
