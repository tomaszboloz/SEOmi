use serde_json::Value;

pub fn audit_text_lines(audit: &Value) -> Vec<String> {
    let read = |pointer: &str| {
        audit
            .pointer(pointer)
            .and_then(Value::as_str)
            .unwrap_or("-")
            .to_string()
    };
    let number = |pointer: &str| {
        audit
            .pointer(pointer)
            .and_then(Value::as_i64)
            .map(|value| value.to_string())
            .unwrap_or_else(|| "-".into())
    };
    let mut lines = vec![
        "SEOmi - audit report".into(),
        format!("Audited URL: {}", read("/final_url")),
        format!("Audited at: {}", read("/timestamp")),
        format!("HTTP status: {}", number("/http_status")),
        format!("Response time: {} ms", number("/response_time_ms")),
        format!("Health score: {} / 100", number("/health_score")),
        format!("Title: {}", read("/meta_tags/title")),
        format!("Meta description: {}", read("/meta_tags/description")),
        format!("Canonical: {}", read("/meta_tags/canonical")),
        format!("H1 count: {}", number("/headings/h1_count")),
        format!(
            "Images: {} | Links: {}",
            audit
                .get("images")
                .and_then(Value::as_array)
                .map(Vec::len)
                .unwrap_or(0),
            number("/links/total_links")
        ),
        "".into(),
        "Issues detected by local audit rules:".into(),
    ];
    let issues = audit
        .get("issues")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if issues.is_empty() {
        lines.push("No issues were reported by this audit.".into());
    } else {
        for issue in issues {
            let severity = issue
                .get("severity")
                .and_then(Value::as_str)
                .unwrap_or("Info");
            let category = issue
                .get("category")
                .and_then(Value::as_str)
                .unwrap_or("Technical");
            let message = issue.get("message").and_then(Value::as_str).unwrap_or("-");
            lines.push(format!("[{severity}] {category}: {message}"));
        }
    }
    lines.push("".into());
    lines.push(
        "Method: local HTTP and HTML analysis. This report is not a Google indexation verdict."
            .into(),
    );
    lines
}
