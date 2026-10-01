use crate::models::audit_data::StructuredDataValidationIssue;
use serde_json::Value;
use std::collections::HashSet;
use url::Url;

const MAX_JSONLD_NODES: usize = 2_048;
const MAX_JSONLD_DEPTH: usize = 64;
const MAX_JSONLD_TYPES_PER_NODE: usize = 64;
const MAX_VALIDATION_ISSUES: usize = 500;
const MAX_CONTEXT_DEPTH: usize = 16;

#[derive(Default)]
struct IssueCollector {
    issues: Vec<StructuredDataValidationIssue>,
    truncated: bool,
}

impl IssueCollector {
    fn push(&mut self, issue: StructuredDataValidationIssue) {
        if self.issues.len() < MAX_VALIDATION_ISSUES - 1 && !self.truncated {
            self.issues.push(issue);
        } else if !self.truncated {
            self.issues.push(StructuredDataValidationIssue {
                code: "schema-validation-findings-truncated".into(),
                severity: "info".into(),
                message: format!("Local structured-data findings were capped at {MAX_VALIDATION_ISSUES} to keep the audit bounded."),
                path: None,
                recommendation: Some("Review the source declaration directly; this local report omits findings beyond its safety limit.".into()),
            });
            self.truncated = true;
        }
    }

    fn finish(mut self, traversal_truncated: bool) -> Vec<StructuredDataValidationIssue> {
        if traversal_truncated && !self.truncated {
            self.push(StructuredDataValidationIssue {
                code: "schema-validation-traversal-truncated".into(),
                severity: "info".into(),
                message:
                    "Local structured-data validation stopped at its node, depth, or type limit."
                        .into(),
                path: None,
                recommendation: Some(
                    "Review the full declaration in the source; not all nested data was validated."
                        .into(),
                ),
            });
        }
        self.issues
    }
}

fn issue(
    code: &str,
    severity: &str,
    message: impl Into<String>,
    path: Option<String>,
    recommendation: Option<&str>,
) -> StructuredDataValidationIssue {
    StructuredDataValidationIssue {
        code: code.into(),
        severity: severity.into(),
        message: message.into(),
        path,
        recommendation: recommendation.map(str::to_string),
    }
}

fn schema_org_iri(value: &str) -> bool {
    let Ok(url) = Url::parse(value) else {
        return false;
    };
    matches!(url.scheme(), "http" | "https")
        && url.host_str().is_some_and(|host| {
            host.eq_ignore_ascii_case("schema.org") || host.eq_ignore_ascii_case("www.schema.org")
        })
}

fn context_contains_schema_org(context: &Value) -> bool {
    fn visit(context: &Value, depth: usize) -> bool {
        if depth > MAX_CONTEXT_DEPTH {
            return false;
        }
        match context {
            Value::String(value) => schema_org_iri(value),
            Value::Array(values) => values.iter().any(|value| visit(value, depth + 1)),
            Value::Object(values) => values.values().any(|value| {
                value.as_str().is_some_and(schema_org_iri)
                    || matches!(value, Value::Array(_) | Value::Object(_))
                        && visit(value, depth + 1)
            }),
            _ => false,
        }
    }

    visit(context, 0)
}

fn type_name(value: &str) -> &str {
    value
        .trim_end_matches('/')
        .rsplit(['/', '#', ':'])
        .next()
        .unwrap_or(value)
}

fn type_values(value: &Value, path: &str, issues: &mut IssueCollector) -> Vec<String> {
    match value {
        Value::String(value) if !value.trim().is_empty() => vec![value.trim().into()],
        Value::Array(values) => {
            let mut result = Vec::new();
            for (index, item) in values.iter().take(MAX_JSONLD_TYPES_PER_NODE).enumerate() {
                match item.as_str().map(str::trim).filter(|item| !item.is_empty()) {
                    Some(item) => result.push(item.to_string()),
                    None => issues.push(issue(
                        "jsonld-type-item-invalid",
                        "error",
                        "Every entry in @type must be a non-empty string.",
                        Some(format!("{path}[{index}]")),
                        Some("Use a Schema.org type name or an absolute type IRI."),
                    )),
                }
            }
            if result.is_empty() {
                issues.push(issue(
                    "jsonld-type-empty",
                    "error",
                    "@type is present but contains no usable type.",
                    Some(path.into()),
                    Some("Set @type to a string or a non-empty array of strings."),
                ));
            }
            if values.len() > MAX_JSONLD_TYPES_PER_NODE {
                issues.push(issue(
                    "jsonld-type-list-truncated",
                    "info",
                    format!("@type has more than {MAX_JSONLD_TYPES_PER_NODE} entries; remaining entries were not validated."),
                    Some(path.into()),
                    Some("Keep only applicable, distinct types in @type."),
                ));
            }
            result
        }
        _ => {
            issues.push(issue(
                "jsonld-type-invalid",
                "error",
                "@type must be a non-empty string or an array of strings.",
                Some(path.into()),
                Some("Use a Schema.org type name or an absolute type IRI."),
            ));
            Vec::new()
        }
    }
}

fn validate_profile(
    data_type: &str,
    properties: &HashSet<String>,
    path: &str,
    issues: &mut IssueCollector,
) {
    let name = type_name(data_type);
    match name.to_ascii_lowercase().as_str() {
        "product" => {
            if !properties.contains("name") {
                issues.push(issue(
                    "product-name-missing",
                    "warning",
                    "Product has no name property in the locally supported product rich-result profile.",
                    Some(path.into()),
                    Some("Add a non-empty name property to Product."),
                ));
            }
            if !["offers", "review", "aggregaterating"]
                .iter()
                .any(|property| properties.contains(*property))
            {
                issues.push(issue(
                    "product-offer-review-missing",
                    "warning",
                    "Product has no offers, review, or aggregateRating property in the locally supported product rich-result profile.",
                    Some(path.into()),
                    Some("Add accurate offers, review, or aggregateRating data when applicable."),
                ));
            }
        }
        "breadcrumblist" if !properties.contains("itemlistelement") => {
            issues.push(issue(
                "breadcrumb-items-missing",
                "warning",
                "BreadcrumbList has no itemListElement property.",
                Some(path.into()),
                Some("Add an ordered itemListElement array of ListItem records."),
            ));
        }
        "article" | "newsarticle" | "blogposting" if !properties.contains("headline") => {
            issues.push(issue(
                "article-headline-recommended",
                "info",
                "Article-family data has no headline property.",
                Some(path.into()),
                Some("Add the article headline when it is available in the visible page content."),
            ));
        }
        "organization" | "website" | "webpage" | "localbusiness"
            if !properties.contains("name") =>
        {
            issues.push(issue(
                "schema-name-missing",
                "warning",
                format!("{name} has no name property in the locally supported Schema.org profile."),
                Some(path.into()),
                Some("Add an accurate non-empty name when the entity is represented on the page."),
            ));
        }
        "faqpage" if !properties.contains("mainentity") => {
            issues.push(issue(
                "faq-main-entity-missing",
                "warning",
                "FAQPage has no mainEntity property in the locally supported FAQ profile.",
                Some(path.into()),
                Some("Provide the FAQ questions as mainEntity Question objects when applicable."),
            ));
        }
        "question" if !properties.contains("name") => {
            issues.push(issue(
                "question-name-missing",
                "warning",
                "Question has no name property in the locally supported FAQ profile.",
                Some(path.into()),
                Some("Add the visible question text as name."),
            ));
        }
        "event" if !properties.contains("name") => {
            issues.push(issue(
                "event-name-missing",
                "warning",
                "Event has no name property in the locally supported event profile.",
                Some(path.into()),
                Some("Add the visible event name as a non-empty name."),
            ));
        }
        "recipe" if !properties.contains("name") => {
            issues.push(issue(
                "recipe-name-missing",
                "warning",
                "Recipe has no name property in the locally supported recipe profile.",
                Some(path.into()),
                Some("Add the visible recipe name as a non-empty name."),
            ));
        }
        "videoobject" if !properties.contains("name") => {
            issues.push(issue(
                "video-name-missing",
                "warning",
                "VideoObject has no name property in the locally supported video profile.",
                Some(path.into()),
                Some("Add the visible video name as a non-empty name."),
            ));
        }
        "review" if !properties.contains("reviewbody") => {
            issues.push(issue(
                "review-body-missing",
                "info",
                "Review has no reviewBody property in the locally supported review profile.",
                Some(path.into()),
                Some("Add the visible review text when the review body is available."),
            ));
        }
        "person" | "author" if !properties.contains("name") => {
            issues.push(issue(
                "person-name-missing",
                "warning",
                "Person has no name property in the locally supported person profile.",
                Some(path.into()),
                Some("Add the person's visible name."),
            ));
        }
        "imageobject" if !properties.contains("contenturl") && !properties.contains("url") => {
            issues.push(issue(
                "image-url-missing",
                "warning",
                "ImageObject has no contentUrl or url property in the locally supported image profile.",
                Some(path.into()),
                Some("Provide the image URL that is represented by this ImageObject."),
            ));
        }
        _ => {}
    }
}

fn non_empty_string_property(value: &serde_json::Map<String, Value>, property: &str) -> bool {
    value
        .get(property)
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty())
}

fn validate_jsonld_profile_values(
    data_type: &str,
    value: &serde_json::Map<String, Value>,
    path: &str,
    issues: &mut IssueCollector,
) {
    let issue_at = |code: &str, message: String, property: &str| {
        issue(
            code,
            "warning",
            message,
            Some(format!("{path}.{property}")),
            Some("Check the property value and its expected Schema.org shape in the source declaration."),
        )
    };
    match type_name(data_type).to_ascii_lowercase().as_str() {
        "product" => {
            if value.contains_key("name") && !non_empty_string_property(value, "name") {
                issues.push(issue_at(
                    "product-name-empty-or-invalid",
                    "Product name is present but is not a non-empty string in the local profile."
                        .into(),
                    "name",
                ));
            }
            for property in ["offers", "review", "aggregateRating"] {
                if let Some(field) = value.get(property) {
                    let has_supported_shape = match field {
                        Value::Object(_) => true,
                        Value::Array(items) => {
                            !items.is_empty() && items.iter().all(Value::is_object)
                        }
                        _ => false,
                    };
                    if !has_supported_shape {
                        issues.push(issue_at(
                            "product-related-property-shape-invalid",
                            format!("Product {property} must be a non-empty object or an array of objects in the local profile."),
                            property,
                        ));
                    }
                }
            }
        }
        "breadcrumblist" => {
            if let Some(Value::Array(items)) = value.get("itemListElement") {
                if items.is_empty() {
                    issues.push(issue_at(
                        "breadcrumb-items-empty",
                        "BreadcrumbList itemListElement is present but empty in the local profile."
                            .into(),
                        "itemListElement",
                    ));
                }
                for (index, item) in items.iter().take(MAX_JSONLD_NODES).enumerate() {
                    let item_path = format!("{path}.itemListElement[{index}]");
                    let Some(item_object) = item.as_object() else {
                        issues.push(issue(
                            "breadcrumb-list-item-invalid",
                            "warning",
                            "BreadcrumbList entries should be ListItem objects in the local profile.",
                            Some(item_path),
                            Some("Use a ListItem with position, name, and the breadcrumb URL when available."),
                        ));
                        continue;
                    };
                    let item_type_valid = item_object
                        .get("@type")
                        .and_then(Value::as_str)
                        .is_some_and(|item_type| {
                            type_name(item_type).eq_ignore_ascii_case("ListItem")
                        });
                    if !item_type_valid {
                        issues.push(issue(
                            "breadcrumb-list-item-type-missing",
                            "warning",
                            "BreadcrumbList entry has no detectable ListItem @type in the local profile.",
                            Some(format!("{item_path}.@type")),
                            Some("Set @type to ListItem for each breadcrumb entry."),
                        ));
                    }
                    let positive_position = item_object.get("position").is_some_and(|position| {
                        position.as_u64().is_some_and(|position| position > 0)
                            || position
                                .as_str()
                                .and_then(|position| position.parse::<u64>().ok())
                                .is_some_and(|position| position > 0)
                    });
                    if !positive_position {
                        issues.push(issue(
                            "breadcrumb-position-invalid",
                            "warning",
                            "Breadcrumb ListItem position must be a positive integer in the local profile.",
                            Some(format!("{item_path}.position")),
                            Some("Set a positive, ordered position value on each ListItem."),
                        ));
                    }
                    if !non_empty_string_property(item_object, "name") {
                        issues.push(issue(
                            "breadcrumb-name-empty-or-invalid",
                            "warning",
                            "Breadcrumb ListItem name must be a non-empty string in the local profile.",
                            Some(format!("{item_path}.name")),
                            Some("Add the visible breadcrumb label as a non-empty name."),
                        ));
                    }
                }
                if items.len() > MAX_JSONLD_NODES {
                    issues.push(issue(
                        "breadcrumb-list-truncated",
                        "info",
                        format!("BreadcrumbList validation was limited to {MAX_JSONLD_NODES} entries."),
                        Some(format!("{path}.itemListElement")),
                        Some("Review entries beyond the local validation limit in the source declaration."),
                    ));
                }
            }
        }
        "article" | "newsarticle" | "blogposting" => {
            if value.contains_key("headline") && !non_empty_string_property(value, "headline") {
                issues.push(issue_at(
                    "article-headline-empty-or-invalid",
                    "Article headline is present but is not a non-empty string in the local profile.".into(),
                    "headline",
                ));
            }
        }
        "organization" | "website" | "webpage" | "localbusiness" => {
            if value.contains_key("name") && !non_empty_string_property(value, "name") {
                issues.push(issue_at(
                    "schema-name-empty-or-invalid",
                    "The profile name is present but is not a non-empty string in the local ruleset."
                        .into(),
                    "name",
                ));
            }
        }
        "faqpage" => {
            let Some(main_entity) = value.get("mainEntity") else {
                return;
            };
            let questions = match main_entity {
                Value::Object(object) => vec![object],
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
                        objects.push(object);
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
            for (index, question) in questions.iter().enumerate() {
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
                        || answer.as_array().is_some_and(|items| {
                            !items.is_empty() && items.iter().all(Value::is_object)
                        })
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
        "event" => {
            validate_non_empty_string_if_present(
                value,
                path,
                "name",
                "event-name-empty-or-invalid",
                issues,
            );
            validate_non_empty_string_if_present(
                value,
                path,
                "startDate",
                "event-start-date-empty-or-invalid",
                issues,
            );
            validate_object_or_string_if_present(
                value,
                path,
                "location",
                "event-location-shape-invalid",
                issues,
            );
            validate_non_empty_string_if_present(
                value,
                path,
                "eventStatus",
                "event-status-empty-or-invalid",
                issues,
            );
        }
        "recipe" => {
            validate_non_empty_string_if_present(
                value,
                path,
                "name",
                "recipe-name-empty-or-invalid",
                issues,
            );
            validate_string_or_array_if_present(
                value,
                path,
                "image",
                "recipe-image-shape-invalid",
                issues,
            );
            validate_object_or_string_if_present(
                value,
                path,
                "author",
                "recipe-author-shape-invalid",
                issues,
            );
            validate_string_if_present(value, path, "prepTime", "recipe-prep-time-invalid", issues);
            validate_string_if_present(value, path, "cookTime", "recipe-cook-time-invalid", issues);
            validate_string_if_present(
                value,
                path,
                "totalTime",
                "recipe-total-time-invalid",
                issues,
            );
        }
        "videoobject" => {
            validate_non_empty_string_if_present(
                value,
                path,
                "name",
                "video-name-empty-or-invalid",
                issues,
            );
            validate_string_or_array_if_present(
                value,
                path,
                "thumbnailUrl",
                "video-thumbnail-shape-invalid",
                issues,
            );
            validate_non_empty_string_if_present(
                value,
                path,
                "uploadDate",
                "video-upload-date-empty-or-invalid",
                issues,
            );
            validate_non_empty_string_if_present(
                value,
                path,
                "contentUrl",
                "video-content-url-empty-or-invalid",
                issues,
            );
        }
        "review" => {
            validate_non_empty_string_if_present(
                value,
                path,
                "reviewBody",
                "review-body-empty-or-invalid",
                issues,
            );
            validate_object_or_string_if_present(
                value,
                path,
                "author",
                "review-author-shape-invalid",
                issues,
            );
            validate_object_or_string_if_present(
                value,
                path,
                "reviewRating",
                "review-rating-shape-invalid",
                issues,
            );
        }
        "offer" => {
            validate_string_or_number_if_present(
                value,
                path,
                "price",
                "offer-price-shape-invalid",
                issues,
            );
            validate_non_empty_string_if_present(
                value,
                path,
                "priceCurrency",
                "offer-currency-empty-or-invalid",
                issues,
            );
            validate_non_empty_string_if_present(
                value,
                path,
                "availability",
                "offer-availability-empty-or-invalid",
                issues,
            );
            validate_non_empty_string_if_present(
                value,
                path,
                "url",
                "offer-url-empty-or-invalid",
                issues,
            );
        }
        "person" | "author" => {
            validate_non_empty_string_if_present(
                value,
                path,
                "name",
                "person-name-empty-or-invalid",
                issues,
            );
            validate_non_empty_string_if_present(
                value,
                path,
                "url",
                "person-url-empty-or-invalid",
                issues,
            );
        }
        "imageobject" => {
            validate_non_empty_string_if_present(
                value,
                path,
                "contentUrl",
                "image-content-url-empty-or-invalid",
                issues,
            );
            validate_non_empty_string_if_present(
                value,
                path,
                "url",
                "image-url-empty-or-invalid",
                issues,
            );
            validate_non_empty_string_if_present(
                value,
                path,
                "caption",
                "image-caption-empty-or-invalid",
                issues,
            );
        }
        _ => {}
    }
}

fn validate_non_empty_string_if_present(
    value: &serde_json::Map<String, Value>,
    path: &str,
    property: &str,
    code: &str,
    issues: &mut IssueCollector,
) {
    if value.contains_key(property) && !non_empty_string_property(value, property) {
        issues.push(issue(
            code,
            "warning",
            format!("Schema property {property} is present but is not a non-empty string in the local profile."),
            Some(format!("{path}.{property}")),
            Some("Provide a non-empty value with the expected Schema.org shape."),
        ));
    }
}

fn validate_string_if_present(
    value: &serde_json::Map<String, Value>,
    path: &str,
    property: &str,
    code: &str,
    issues: &mut IssueCollector,
) {
    if value.contains_key(property) && value.get(property).and_then(Value::as_str).is_none() {
        issues.push(issue(
            code,
            "warning",
            format!("Schema property {property} must be a string in the local profile."),
            Some(format!("{path}.{property}")),
            Some("Use the expected string representation for this Schema.org property."),
        ));
    }
}

fn validate_string_or_number_if_present(
    value: &serde_json::Map<String, Value>,
    path: &str,
    property: &str,
    code: &str,
    issues: &mut IssueCollector,
) {
    if value.contains_key(property)
        && value.get(property).is_some_and(|property_value| {
            !property_value.is_string() && !property_value.is_number()
        })
    {
        issues.push(issue(
            code,
            "warning",
            format!("Schema property {property} must be a string or number in the local profile."),
            Some(format!("{path}.{property}")),
            Some("Use a numeric or string value with the expected Schema.org shape."),
        ));
    }
}

fn validate_object_or_string_if_present(
    value: &serde_json::Map<String, Value>,
    path: &str,
    property: &str,
    code: &str,
    issues: &mut IssueCollector,
) {
    if value.contains_key(property)
        && value.get(property).is_some_and(|property_value| {
            !property_value.is_object() && !property_value.is_string()
        })
    {
        issues.push(issue(
            code,
            "warning",
            format!("Schema property {property} must be an object or string in the local profile."),
            Some(format!("{path}.{property}")),
            Some("Use an embedded entity object or a string reference."),
        ));
    }
}

fn validate_string_or_array_if_present(
    value: &serde_json::Map<String, Value>,
    path: &str,
    property: &str,
    code: &str,
    issues: &mut IssueCollector,
) {
    if value.contains_key(property)
        && value
            .get(property)
            .is_some_and(|property_value| !property_value.is_string() && !property_value.is_array())
    {
        issues.push(issue(
            code,
            "warning",
            format!("Schema property {property} must be a string or array in the local profile."),
            Some(format!("{path}.{property}")),
            Some("Use one URL string or an array of URL strings."),
        ));
    }
}

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
                walk_jsonld(item, &format!("{path}[{index}]"), depth + 1, budget, issues);
            }
        }
        Value::Object(object) => {
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
                    validate_profile(&data_type, &properties, path, issues);
                    validate_jsonld_profile_values(&data_type, object, path, issues);
                }
            } else if object.keys().any(|key| !key.starts_with('@'))
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
                    walk_jsonld(child, &format!("{path}.{key}"), depth + 1, budget, issues);
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
            Some("This local validator applies Schema.org-specific profile rules only when a Schema.org context is declared."),
        ));
    }
    let mut budget = TraversalBudget::default();
    walk_jsonld(value, "$", 0, &mut budget, &mut issues);
    issues.finish(budget.truncated)
}

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

pub fn validate(format: &str, content: &Value) -> Vec<StructuredDataValidationIssue> {
    match format {
        "JSON-LD" => validate_jsonld(content),
        "Microdata" => validate_microdata(content),
        "RDFa" => validate_rdfa(content),
        _ => vec![issue(
            "schema-format-unsupported",
            "info",
            format!("No local validation rules are defined for `{format}`."),
            None,
            None,
        )],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reports_jsonld_syntax_and_supported_product_profile_findings() {
        let issues = validate_jsonld(&json!({
            "@context": "https://schema.org",
            "@type": "Product",
            "description": "A product without the supported rich result fields"
        }));
        assert!(issues
            .iter()
            .any(|item| item.code == "product-name-missing"));
        assert!(issues
            .iter()
            .any(|item| item.code == "product-offer-review-missing"));
        assert!(!issues.iter().any(|item| item.severity == "error"));
    }

    #[test]
    fn validates_supported_profile_values_and_breadcrumb_item_structure() {
        let issues = validate_jsonld(&json!({
            "@context": "https://schema.org",
            "@graph": [
                { "@type": "Product", "name": " ", "offers": null },
                { "@type": "BlogPosting", "headline": 42 },
                { "@type": "BreadcrumbList", "itemListElement": [
                    { "@type": "ListItem", "position": 0, "name": " " },
                    { "position": 2, "name": "Second" },
                    "https://example.test/third"
                ] }
            ]
        }));

        for code in [
            "product-name-empty-or-invalid",
            "product-related-property-shape-invalid",
            "article-headline-empty-or-invalid",
            "breadcrumb-position-invalid",
            "breadcrumb-name-empty-or-invalid",
            "breadcrumb-list-item-type-missing",
            "breadcrumb-list-item-invalid",
        ] {
            assert!(
                issues.iter().any(|item| item.code == code),
                "expected {code}"
            );
        }
    }

    #[test]
    fn accepts_well_shaped_values_in_the_supported_local_profiles() {
        let issues = validate_jsonld(&json!({
            "@context": "https://schema.org",
            "@graph": [
                { "@type": "Product", "name": "Example", "offers": { "@type": "Offer", "price": "10.00" } },
                { "@type": "Article", "headline": "Example article" },
                { "@type": "BreadcrumbList", "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.test/" }
                ] }
            ]
        }));

        assert!(!issues
            .iter()
            .any(|item| item.severity == "error" || item.severity == "warning"));
    }

    #[test]
    fn validates_nested_graphs_and_type_shapes_without_rejecting_custom_types() {
        let issues = validate_jsonld(&json!({
            "@context": { "@vocab": "https://schema.org/" },
            "@graph": [
                { "@type": ["Article", "Article"], "headline": "Example" },
                { "@type": ["CustomType", 42] }
            ]
        }));
        assert!(issues
            .iter()
            .any(|item| item.code == "jsonld-type-duplicate"));
        assert!(issues
            .iter()
            .any(|item| item.code == "jsonld-type-item-invalid"));
        assert!(!issues.iter().any(|item| item.code == "schema-type-unknown"));
    }

    #[test]
    fn detects_schema_org_context_declared_through_a_prefix_map() {
        let issues = validate_jsonld(&json!({
            "@context": {
                "schema": "https://schema.org/",
                "name": "schema:name"
            },
            "@type": "schema:Article",
            "headline": "Prefix context"
        }));

        assert!(!issues
            .iter()
            .any(|item| item.code == "jsonld-schema-context-not-detected"));
    }

    #[test]
    fn bounds_deep_context_maps_before_schema_detection() {
        let mut context = json!("https://schema.org/");
        for _ in 0..(MAX_CONTEXT_DEPTH + 8) {
            context = json!({ "nested": context });
        }
        let issues = validate_jsonld(&json!({
            "@context": context,
            "@type": "Thing",
            "name": "bounded"
        }));

        assert!(issues
            .iter()
            .any(|item| item.code == "jsonld-schema-context-not-detected"));
    }

    #[test]
    fn caps_large_jsonld_traversals_and_reports_the_partial_validation() {
        let value = Value::Array(
            (0..MAX_JSONLD_NODES + 100)
                .map(|index| {
                    json!({
                        "@type": "Thing",
                        "name": format!("item-{index}"),
                    })
                })
                .collect(),
        );

        let issues = validate_jsonld(&value);
        assert!(issues.len() <= MAX_VALIDATION_ISSUES);
        assert!(issues
            .iter()
            .any(|item| item.code == "schema-validation-traversal-truncated"));
    }

    #[test]
    fn caps_large_type_lists_and_reports_omitted_entries() {
        let value = json!({
            "@context": "https://schema.org",
            "@type": (0..MAX_JSONLD_TYPES_PER_NODE + 1)
                .map(|index| format!("Type{index}"))
                .collect::<Vec<_>>(),
        });

        let issues = validate_jsonld(&value);
        assert!(issues
            .iter()
            .any(|item| item.code == "jsonld-type-list-truncated"));
    }

    #[test]
    fn caps_the_number_of_emitted_findings() {
        let invalid_types = vec![json!(42); MAX_JSONLD_TYPES_PER_NODE];
        let value = Value::Array(
            (0..MAX_JSONLD_NODES)
                .map(|_| json!({ "@type": invalid_types.clone() }))
                .collect(),
        );

        let issues = validate_jsonld(&value);
        assert_eq!(issues.len(), MAX_VALIDATION_ISSUES);
        assert!(issues
            .iter()
            .any(|item| item.code == "schema-validation-findings-truncated"));
    }

    #[test]
    fn validates_microdata_and_rdfa_declaration_shapes() {
        let microdata = validate_microdata(&json!({ "itemtype": "Product", "itemprops": [] }));
        assert!(microdata
            .iter()
            .any(|item| item.code == "microdata-itemtype-not-absolute"));

        let rdfa = validate_rdfa(&json!({ "vocab": "not a URL", "typeof": 4 }));
        assert!(rdfa
            .iter()
            .any(|item| item.code == "rdfa-vocab-not-absolute"));
        assert!(rdfa
            .iter()
            .any(|item| item.code == "rdfa-term-shape-invalid"));
    }

    #[test]
    fn validates_microdata_identifiers_references_and_duplicate_properties() {
        let issues = validate_microdata(&json!({
            "itemtype": "https://schema.org/Product",
            "itemid": "/relative-product",
            "itemref": ["details", "details", ""],
            "itemprops": ["name", "name", 7]
        }));
        for code in [
            "microdata-itemid-not-absolute",
            "microdata-itemref-duplicate",
            "microdata-itemref-invalid",
            "microdata-itemprop-duplicate",
            "microdata-itemprop-invalid",
        ] {
            assert!(
                issues.iter().any(|item| item.code == code),
                "expected {code}"
            );
        }
    }

    #[test]
    fn validates_rdfa_relation_and_literal_attribute_shapes() {
        let issues = validate_rdfa(&json!({
            "vocab": "https://schema.org",
            "typeof": "",
            "property": "name",
            "rel": 4,
            "rev": "",
            "datatype": false,
            "content": "literal",
            "prefix": 8
        }));
        assert!(issues.iter().any(|item| item.code == "rdfa-term-empty"));
        assert!(issues
            .iter()
            .any(|item| item.code == "rdfa-term-shape-invalid"));
        assert!(issues
            .iter()
            .any(|item| item.path.as_deref() == Some("rel")));
    }

    #[test]
    fn validates_common_organization_website_and_faq_profiles() {
        let issues = validate_jsonld(&json!({
            "@context": "https://schema.org",
            "@graph": [
                { "@type": "Organization", "name": 7 },
                { "@type": "WebSite", "url": "https://example.test" },
                { "@type": "WebPage", "name": " " },
                { "@type": "LocalBusiness", "name": "Shop" },
                { "@type": "FAQPage", "mainEntity": [
                    { "@type": "Question", "name": " ", "acceptedAnswer": "plain text" },
                    { "name": "Second" }
                ] }
            ]
        }));
        for code in [
            "schema-name-empty-or-invalid",
            "schema-name-missing",
            "faq-question-name-empty-or-invalid",
            "faq-answer-shape-invalid",
            "faq-question-type-missing",
        ] {
            assert!(
                issues.iter().any(|item| item.code == code),
                "expected {code}"
            );
        }
    }

    #[test]
    fn validates_additional_event_recipe_video_review_and_entity_profiles() {
        let issues = validate_jsonld(&json!({
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Event",
                    "name": 7,
                    "startDate": [],
                    "location": 42,
                    "eventStatus": " "
                },
                {
                    "@type": "Recipe",
                    "name": " ",
                    "image": 7,
                    "author": 4,
                    "prepTime": 2
                },
                {
                    "@type": "VideoObject",
                    "name": "Video",
                    "thumbnailUrl": false,
                    "uploadDate": 4,
                    "contentUrl": " "
                },
                {
                    "@type": "Review",
                    "reviewBody": " ",
                    "author": 8,
                    "reviewRating": false
                },
                {
                    "@type": "Offer",
                    "price": [],
                    "priceCurrency": " ",
                    "availability": 4,
                    "url": false
                },
                { "@type": "Person", "name": 8, "url": false },
                { "@type": "ImageObject", "contentUrl": 8, "caption": false }
            ]
        }));

        for code in [
            "event-name-empty-or-invalid",
            "event-start-date-empty-or-invalid",
            "event-location-shape-invalid",
            "event-status-empty-or-invalid",
            "recipe-name-empty-or-invalid",
            "recipe-image-shape-invalid",
            "recipe-author-shape-invalid",
            "recipe-prep-time-invalid",
            "video-thumbnail-shape-invalid",
            "video-upload-date-empty-or-invalid",
            "video-content-url-empty-or-invalid",
            "review-body-empty-or-invalid",
            "review-author-shape-invalid",
            "review-rating-shape-invalid",
            "offer-price-shape-invalid",
            "offer-currency-empty-or-invalid",
            "offer-availability-empty-or-invalid",
            "offer-url-empty-or-invalid",
            "person-name-empty-or-invalid",
            "person-url-empty-or-invalid",
            "image-content-url-empty-or-invalid",
            "image-caption-empty-or-invalid",
        ] {
            assert!(
                issues.iter().any(|item| item.code == code),
                "expected {code}"
            );
        }
    }

    #[test]
    fn accepts_well_shaped_additional_schema_profiles() {
        let issues = validate_jsonld(&json!({
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Event",
                    "name": "Conference",
                    "startDate": "2026-10-01",
                    "location": { "@type": "Place", "name": "Hall" },
                    "eventStatus": "https://schema.org/EventScheduled"
                },
                {
                    "@type": "Recipe",
                    "name": "Soup",
                    "image": ["https://example.test/soup.jpg"],
                    "author": { "@type": "Person", "name": "Chef" },
                    "prepTime": "PT10M",
                    "cookTime": "PT20M",
                    "totalTime": "PT30M"
                },
                {
                    "@type": "VideoObject",
                    "name": "Demo",
                    "thumbnailUrl": "https://example.test/thumb.jpg",
                    "uploadDate": "2026-09-24",
                    "contentUrl": "https://example.test/demo.mp4"
                },
                {
                    "@type": "Review",
                    "reviewBody": "Useful",
                    "author": { "@type": "Person", "name": "Reviewer" },
                    "reviewRating": { "@type": "Rating", "ratingValue": 5 }
                },
                {
                    "@type": "Offer",
                    "price": 10,
                    "priceCurrency": "USD",
                    "availability": "https://schema.org/InStock",
                    "url": "https://example.test/buy"
                },
                { "@type": "Person", "name": "Author", "url": "https://example.test/author" },
                {
                    "@type": "ImageObject",
                    "contentUrl": "https://example.test/image.jpg",
                    "caption": "Example"
                }
            ]
        }));

        assert!(!issues
            .iter()
            .any(|item| item.severity == "error" || item.severity == "warning"));
    }
    #[test]
    fn public_dispatch_matches_each_validator_and_reports_unsupported_format() {
        let document = serde_json::json!({"@context":"https://schema.org","@type":"Product"});
        assert_eq!(
            serde_json::to_value(validate("JSON-LD", &document)).unwrap(),
            serde_json::to_value(validate_jsonld(&document)).unwrap()
        );
        let microdata = serde_json::json!({"itemtype":"https://schema.org/Product"});
        assert_eq!(
            serde_json::to_value(validate("Microdata", &microdata)).unwrap(),
            serde_json::to_value(validate_microdata(&microdata)).unwrap()
        );
        let rdfa = serde_json::json!({"vocab":"https://schema.org","typeof":"Product"});
        assert_eq!(
            serde_json::to_value(validate("RDFa", &rdfa)).unwrap(),
            serde_json::to_value(validate_rdfa(&rdfa)).unwrap()
        );
        let unknown = validate("unsupported", &document);
        assert_eq!(unknown.len(), 1);
        assert_eq!(unknown[0].code, "schema-format-unsupported");
        assert_eq!(unknown[0].severity, "info");
    }

    #[test]
    fn microdata_profiles_report_missing_properties_without_rejecting_external_vocabularies() {
        for (kind, property, code) in [
            (
                "BreadcrumbList",
                "itemListElement",
                "breadcrumb-items-missing",
            ),
            ("Article", "headline", "article-headline-recommended"),
            ("Organization", "name", "schema-name-missing"),
            ("FAQPage", "mainEntity", "faq-main-entity-missing"),
            ("Question", "name", "question-name-missing"),
            ("Event", "name", "event-name-missing"),
            ("Recipe", "name", "recipe-name-missing"),
            ("VideoObject", "name", "video-name-missing"),
            ("Review", "reviewBody", "review-body-missing"),
            ("Person", "name", "person-name-missing"),
            ("ImageObject", "contentUrl", "image-url-missing"),
        ] {
            let iri = format!("https://schema.org/{kind}");
            let missing = validate_microdata(&serde_json::json!({"itemtype":iri,"itemprops":[]}));
            assert!(missing.iter().any(|issue| issue.code == code), "{kind}");
            let present =
                validate_microdata(&serde_json::json!({"itemtype":iri,"itemprops":[property]}));
            assert!(!present.iter().any(|issue| issue.code == code), "{kind}");
        }
        let external =
            validate_microdata(&serde_json::json!({"itemtype":"https://other.example/Product"}));
        assert!(external.iter().any(
            |issue| issue.code == "microdata-non-schema-vocabulary" && issue.severity == "info"
        ));
        assert!(!external.iter().any(|issue| issue.severity == "error"));
        assert!(!external
            .iter()
            .any(|issue| issue.code.starts_with("product-")));
    }

    #[test]
    fn microdata_distinguishes_empty_declarations_and_absolute_identifiers() {
        let empty = validate_microdata(&serde_json::json!({"itemtype":"  "}));
        assert!(empty
            .iter()
            .any(|issue| issue.code == "microdata-itemtype-empty"));
        let relative = validate_microdata(
            &serde_json::json!({"itemtype":"Product","itemid":"relative","itemprops":["name","NAME","",7],"itemref":["id","id","",7]}),
        );
        for code in [
            "microdata-itemtype-not-absolute",
            "microdata-itemid-not-absolute",
            "microdata-itemprop-duplicate",
            "microdata-itemprop-invalid",
            "microdata-itemref-duplicate",
            "microdata-itemref-invalid",
        ] {
            assert!(relative.iter().any(|issue| issue.code == code), "{code}");
        }
        let absolute = validate_microdata(
            &serde_json::json!({"itemtype":"https://schema.org/Thing","itemid":"https://example.com/entity","itemprops":["name"],"itemref":["id"]}),
        );
        assert!(absolute.is_empty());
    }

    #[test]
    fn rdfa_reports_unknown_vocab_as_scope_information_and_invalid_terms_as_errors() {
        let external = validate_rdfa(
            &serde_json::json!({"vocab":"https://other.example/vocab","typeof":"Thing"}),
        );
        assert!(external
            .iter()
            .any(|issue| issue.code == "rdfa-non-schema-vocabulary" && issue.severity == "info"));
        assert!(!external.iter().any(|issue| issue.severity == "error"));
        let malformed = validate_rdfa(
            &serde_json::json!({"vocab":"relative","typeof":42,"property":[],"rel":" ","content":null}),
        );
        assert!(malformed
            .iter()
            .any(|issue| issue.code == "rdfa-vocab-not-absolute"));
        assert_eq!(
            malformed
                .iter()
                .filter(|issue| issue.code == "rdfa-term-shape-invalid")
                .count(),
            2
        );
        assert!(malformed
            .iter()
            .any(|issue| issue.code == "rdfa-term-empty" && issue.path.as_deref() == Some("rel")));
        assert!(!malformed
            .iter()
            .any(|issue| issue.path.as_deref() == Some("content")));
    }

    #[test]
    fn jsonld_present_empty_profile_values_are_reported_separately_from_missing_properties() {
        for (kind, property, code) in [
            ("Product", "name", "product-name-empty-or-invalid"),
            ("Article", "headline", "article-headline-empty-or-invalid"),
            ("Organization", "name", "schema-name-empty-or-invalid"),
        ] {
            let mut document = serde_json::json!({"@context":"https://schema.org","@type":kind});
            document[property] = serde_json::json!(" ");
            assert!(validate_jsonld(&document)
                .iter()
                .any(|issue| issue.code == code));
            document[property] = serde_json::json!("Visible value");
            assert!(!validate_jsonld(&document)
                .iter()
                .any(|issue| issue.code == code));
        }
        let invalid_product = validate_jsonld(
            &serde_json::json!({"@context":"https://schema.org","@type":"Product","name":"Product","offers":[],"review":"text","aggregateRating":false}),
        );
        assert_eq!(
            invalid_product
                .iter()
                .filter(|issue| issue.code == "product-related-property-shape-invalid")
                .count(),
            3
        );
    }

    #[test]
    fn faq_profile_distinguishes_malformed_entries_and_missing_main_entity() {
        for main_entity in [
            serde_json::json!(null),
            serde_json::json!([]),
            serde_json::json!("text"),
        ] {
            let issues = validate_jsonld(
                &serde_json::json!({"@context":"https://schema.org","@type":"FAQPage","mainEntity":main_entity}),
            );
            assert!(issues
                .iter()
                .any(|issue| issue.code == "faq-main-entity-shape-invalid"));
        }
        let issues = validate_jsonld(
            &serde_json::json!({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[null,{"@type":"Question","name":"Visible question","acceptedAnswer":{"@type":"Answer","text":"Visible answer"}}]}),
        );
        assert!(issues
            .iter()
            .any(|issue| issue.code == "faq-question-shape-invalid"));
        let missing = validate_jsonld(
            &serde_json::json!({"@context":"https://schema.org","@type":"FAQPage"}),
        );
        assert!(missing
            .iter()
            .any(|issue| issue.code == "faq-main-entity-missing"));
    }
}
