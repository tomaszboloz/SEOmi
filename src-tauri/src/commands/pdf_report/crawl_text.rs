use super::crawl_page_summary::append_page_summary;
use super::crawl_resources_table::append_resources_table;
use super::crawl_tables::*;
use serde_json::Value;

pub fn crawl_text_lines(run: &Value) -> Vec<String> {
    let read = |value: &Value, key: &str| {
        value
            .get(key)
            .and_then(Value::as_str)
            .unwrap_or("-")
            .to_string()
    };
    let number = |value: &Value, key: &str| {
        value
            .get(key)
            .and_then(Value::as_i64)
            .map(|item| item.to_string())
            .unwrap_or_else(|| "-".into())
    };
    let result = run.get("result").unwrap_or(&Value::Null);
    let selected_sections = run
        .get("report_template_sections")
        .and_then(Value::as_array)
        .map(|sections| {
            sections
                .iter()
                .filter_map(Value::as_str)
                .collect::<std::collections::HashSet<_>>()
        });
    let has_section = |section: &str| {
        selected_sections
            .as_ref()
            .map(|sections| sections.contains(section))
            .unwrap_or(true)
    };
    let pages = result
        .get("pages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let resources = result
        .get("resources")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut lines = vec![
        "SEOmi - site crawl report".into(),
        format!("Run ID: {}", read(run, "id")),
        format!("Completed at: {}", read(run, "completed_at")),
        format!("Scope start URL: {}", read(run, "scope_start_url")),
        format!("Pages crawled: {}", number(result, "pages_crawled")),
        format!("Health score: {} / 100", number(result, "health_score")),
        format!(
            "Critical issues: {} | Warnings: {}",
            number(result, "critical_count"),
            number(result, "warning_count")
        ),
        format!(
            "Duration: {} ms | Resources: {}",
            number(result, "duration_ms"),
            resources.len()
        ),
        "".into(),
    ];

    if let Some(reasons) = result.get("limit_reasons").and_then(Value::as_array) {
        let labels = reasons.iter().filter_map(Value::as_str).collect::<Vec<_>>();
        if !labels.is_empty() {
            lines.push(format!("Limits observed: {}", labels.join(", ")));
        }
    }
    if result
        .get("discovery_provenance_truncated")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        lines.push("Discovery provenance: partial at the configured safety cap.".into());
    }

    if has_section("configuration") {
        lines.insert(
            4,
            format!(
                "Configuration: {}",
                run.get("configuration")
                    .map(Value::to_string)
                    .unwrap_or_else(|| "-".into())
            ),
        );
    }

    if has_section("pages") {
        lines.push("Pages from the saved crawl result:".into());
        if pages.is_empty() {
            lines.push("No page records were present in this crawl run.".into());
        }
        for page in &pages {
            append_page_summary(&mut lines, page, &read, &number);
        }
        append_pages_table(&mut lines, &pages);
    }

    if has_section("issues") {
        append_issues_table(&mut lines, &pages);
    }
    if has_section("links") {
        append_links_table(&mut lines, &pages);
    }
    if has_section("images") {
        append_images_table(&mut lines, &pages);
    }
    if has_section("resources") && !resources.is_empty() {
        append_resources_table(&mut lines, &resources);
    }

    lines.push("Method: local HTTP and HTML crawl. Only data stored in the selected run is included; no pages are fetched again for this report.".into());
    lines
}
