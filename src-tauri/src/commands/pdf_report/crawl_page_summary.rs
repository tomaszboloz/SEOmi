use serde_json::Value;

pub fn append_page_summary(
    lines: &mut Vec<String>,
    page: &Value,
    read: &impl Fn(&Value, &str) -> String,
    number: &impl Fn(&Value, &str) -> String,
) {
    let title = read(page, "title");
    let url = read(page, "url");
    let status = number(page, "http_status");
    let indexability = read(page, "indexability_status");
    lines.push(format!("{status} | {title} | {url}"));
    lines.push(format!(
        "Depth: {} | Response: {} ms | Indexability: {indexability} | Words: {}",
        number(page, "depth"),
        number(page, "response_time_ms"),
        number(page, "word_count")
    ));
    if let Some(verdict) = page.get("indexability_verdict") {
        let status = verdict
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("unknown");
        let reasons = verdict
            .get("reasons")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .unwrap_or_default();
        lines.push(format!(
            "Indexability verdict: {status}{}",
            if reasons.is_empty() {
                String::new()
            } else {
                format!(" ({reasons})")
            }
        ));
    }
    let redirect_stop_reason = read(page, "redirect_stop_reason");
    if !redirect_stop_reason.is_empty() {
        lines.push(format!("Redirect stop reason: {redirect_stop_reason}"));
    }
    let issues = page
        .get("issues")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if issues.is_empty() {
        lines.push("Issues: none reported by local crawl rules.".into());
    } else {
        for issue in issues {
            lines.push(format!(
                "[{}] {}",
                issue
                    .get("severity")
                    .and_then(Value::as_str)
                    .unwrap_or("Info"),
                issue.get("message").and_then(Value::as_str).unwrap_or("-")
            ));
        }
    }
    lines.push("".into());
}
