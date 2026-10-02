pub(in crate::services::html_parser) fn json_ld_type_summary(value: &serde_json::Value) -> String {
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
