use serde_json::Value;

pub fn append_resources_table(lines: &mut Vec<String>, resources: &[Value]) {
    lines.push("Resources table (all saved resources):".into());
    lines.push("Resource URL | Type | HTTP | Content-Type | Bytes | Error".into());
    for resource in resources {
        let resource_number = |key: &str| {
            resource
                .get(key)
                .and_then(Value::as_i64)
                .map(|value| value.to_string())
                .unwrap_or_else(|| "-".into())
        };
        lines.push(format!(
            "{} | {} | {} | {} | {} | {}",
            resource.get("url").and_then(Value::as_str).unwrap_or("-"),
            resource
                .get("resource_type")
                .and_then(Value::as_str)
                .unwrap_or("-"),
            resource_number("http_status"),
            resource
                .get("content_type")
                .and_then(Value::as_str)
                .unwrap_or("-"),
            resource_number("content_length"),
            resource
                .get("request_error_kind")
                .and_then(Value::as_str)
                .unwrap_or("-"),
        ));
    }
}
