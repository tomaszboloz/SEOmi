use crate::models::audit_data::StructuredData;
use crate::services::schema_validator;
use scraper::{Html, Selector};

pub(super) fn extract_structured_data(document: &Html) -> Vec<StructuredData> {
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

    // Microdata
    let microdata_selector = Selector::parse("[itemscope]").unwrap();
    for el in document.select(&microdata_selector) {
        let itemtype = el.value().attr("itemtype").map(str::trim);
        let itemprop_selector = Selector::parse("[itemprop]").unwrap();
        let itemprops = el
            .select(&itemprop_selector)
            .flat_map(|property| {
                property
                    .value()
                    .attr("itemprop")
                    .unwrap_or_default()
                    .split_ascii_whitespace()
            })
            .map(str::to_string)
            .collect::<Vec<_>>();
        let itemref = el
            .value()
            .attr("itemref")
            .unwrap_or_default()
            .split_ascii_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>();
        let content = serde_json::json!({
            "itemscope": true,
            "itemtype": itemtype,
            "itemid": el.value().attr("itemid"),
            "itemref": itemref,
            "itemprops": itemprops,
        });
        list.push(StructuredData {
            data_type: if itemtype.map_or(true, str::is_empty) {
                "Unknown Microdata item".into()
            } else {
                itemtype.unwrap().into()
            },
            format: "Microdata".to_string(),
            validation_issues: schema_validator::validate_microdata(&content),
            content,
        });
    }

    // RDFa: preserve only values explicitly declared on the element. This is
    // extraction, not a claim that the vocabulary is semantically valid.
    let rdfa_selector = Selector::parse(
        "[typeof], [property], [vocab], [rel], [rev], [datatype], [content], [prefix]",
    )
    .unwrap();
    for el in document.select(&rdfa_selector) {
        let typeof_value = el
            .value()
            .attr("typeof")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let property = el
            .value()
            .attr("property")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let vocab = el
            .value()
            .attr("vocab")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let rel = el
            .value()
            .attr("rel")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let rev = el
            .value()
            .attr("rev")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let datatype = el
            .value()
            .attr("datatype")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let content_value = el
            .value()
            .attr("content")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let prefix = el
            .value()
            .attr("prefix")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        // `rel` and `content` are common non-RDFa HTML attributes (for
        // example on link/meta elements). Keep the broader selector so their
        // values can be preserved when a real RDFa anchor is present, but do
        // not turn ordinary HTML into structured-data records.
        if typeof_value.is_none() && property.is_none() && vocab.is_none() {
            continue;
        }
        let data_type = typeof_value
            .map(str::to_string)
            .or_else(|| property.map(|value| format!("property: {value}")))
            .or_else(|| vocab.map(|value| format!("vocab: {value}")))
            .expect("RDFa selector guarantees at least one usable attribute");
        let content = serde_json::json!({
            "typeof": typeof_value,
            "property": property,
            "vocab": vocab,
            "about": el.value().attr("about"),
            "resource": el.value().attr("resource"),
            "rel": rel,
            "rev": rev,
            "datatype": datatype,
            "content": content_value,
            "prefix": prefix,
            "inlist": el.value().attr("inlist").is_some(),
        });
        list.push(StructuredData {
            data_type,
            format: "RDFa".to_string(),
            validation_issues: schema_validator::validate_rdfa(&content),
            content,
        });
    }

    list
}

pub(super) fn json_ld_type_summary(value: &serde_json::Value) -> String {
    fn collect(value: &serde_json::Value, output: &mut Vec<String>) {
        match value {
            serde_json::Value::Object(object) => {
                if let Some(value) = object.get("@type") {
                    match value {
                        serde_json::Value::String(value) => output.push(value.clone()),
                        serde_json::Value::Array(values) => output.extend(
                            values
                                .iter()
                                .filter_map(|item| item.as_str().map(str::to_owned)),
                        ),
                        _ => {}
                    }
                }
                for (key, child) in object {
                    if key == "@graph" {
                        collect(child, output);
                    }
                }
            }
            serde_json::Value::Array(values) => {
                for item in values {
                    collect(item, output);
                }
            }
            _ => {}
        }
    }
    let mut types = Vec::new();
    collect(value, &mut types);
    types.sort();
    types.dedup();
    if types.is_empty() {
        "Unknown Schema".into()
    } else {
        types.join(", ")
    }
}
