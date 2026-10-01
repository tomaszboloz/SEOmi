use super::*;

#[derive(Default)]
struct TraversalBudget {
    visited_nodes: usize,
    truncated: bool,
}

fn walk_jsonld(
    value: &Value,
    path: &str,
    depth: usize,
    budget: &mut TraversalBudget,
    issues: &mut IssueCollector,
    context: &JsonLdContext,
) {
    if depth > MAX_JSONLD_DEPTH || budget.visited_nodes >= MAX_JSONLD_NODES {
        budget.truncated = true;
        return;
    }
    budget.visited_nodes += 1;
    match value {
        Value::Array(values) => {
            for (index, item) in values.iter().enumerate() {
                if budget.visited_nodes >= MAX_JSONLD_NODES {
                    budget.truncated = true;
                    break;
                }
                walk_jsonld(
                    item,
                    &format!("{path}[{index}]"),
                    depth + 1,
                    budget,
                    issues,
                    context,
                );
            }
        }
        Value::Object(object) => {
            let mut context = context.clone();
            if let Some(local) = object.get("@context") {
                context.apply(local, 0);
            }
            if object.contains_key("@type") {
                let types = type_values(&object["@type"], &format!("{path}.@type"), issues);
                let properties = object
                    .keys()
                    .filter(|key| !key.starts_with('@'))
                    .map(|key| key.to_ascii_lowercase())
                    .collect::<HashSet<_>>();
                let distinct = types
                    .iter()
                    .map(|value| value.to_ascii_lowercase())
                    .collect::<HashSet<_>>();
                if distinct.len() < types.len() {
                    issues.push(issue(
                        "jsonld-type-duplicate",
                        "warning",
                        "@type contains duplicate entries.",
                        Some(format!("{path}.@type")),
                        Some("Keep each declared type only once."),
                    ));
                }
                for data_type in types {
                    if let Some(iri) = context
                        .expand(&data_type, 0)
                        .filter(|iri| schema_org_iri(iri))
                    {
                        validate_profile(&iri, &properties, path, issues);
                        validate_jsonld_profile_values(&iri, object, path, issues);
                    }
                }
            } else if context.vocab.as_deref().is_some_and(schema_org_iri)
                && object.keys().any(|key| !key.starts_with('@'))
                && !object.contains_key("@graph")
                && !object.contains_key("@value")
            {
                issues.push(issue(
                    "jsonld-node-type-missing",
                    "warning",
                    "An object has Schema.org-style properties but no @type.",
                    Some(path.into()),
                    Some("Declare @type when this object represents a typed Schema.org entity."),
                ));
            }
            for (key, child) in object {
                if key != "@context" {
                    if budget.visited_nodes >= MAX_JSONLD_NODES {
                        budget.truncated = true;
                        break;
                    }
                    walk_jsonld(
                        child,
                        &format!("{path}.{key}"),
                        depth + 1,
                        budget,
                        issues,
                        &context,
                    );
                }
            }
        }
        _ => {}
    }
}

pub fn validate_jsonld(value: &Value) -> Vec<StructuredDataValidationIssue> {
    let mut issues = IssueCollector::default();
    let contexts = match value {
        Value::Object(object) => object.get("@context"),
        Value::Array(values) => values.iter().find_map(|item| item.get("@context")),
        _ => None,
    };
    if !contexts.is_some_and(context_contains_schema_org) {
        issues.push(issue(
            "jsonld-schema-context-not-detected",
            "info",
            "No Schema.org @context was detected in this JSON-LD block.",
            Some("$.@context".into()),
            Some("This local validator applies Schema.org profile rules only to types that resolve locally to a Schema.org IRI; unknown remote contexts are not fetched."),
        ));
    }
    let mut budget = TraversalBudget::default();
    walk_jsonld(
        value,
        "$",
        0,
        &mut budget,
        &mut issues,
        &JsonLdContext::default(),
    );
    issues.finish(budget.truncated)
}
