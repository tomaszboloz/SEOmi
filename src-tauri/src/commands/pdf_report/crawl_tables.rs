use serde_json::Value;

fn read<'a>(value: &'a Value, key: &str) -> &'a str {
    value.get(key).and_then(Value::as_str).unwrap_or("-")
}

fn number(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_i64)
        .map(|item| item.to_string())
        .unwrap_or_else(|| "-".into())
}

pub fn append_pages_table(lines: &mut Vec<String>, pages: &[Value]) {
    lines.push("Pages table (all saved pages):".into());
    lines.push(
        "URL | Final URL | HTTP | Depth | Response ms | Indexability | Redirect stop reason | Words | Issues".into(),
    );
    for page in pages {
        lines.push(format!(
            "{} | {} | {} | {} | {} | {} | {} | {} | {}",
            read(page, "url"),
            read(page, "final_url"),
            number(page, "http_status"),
            number(page, "depth"),
            number(page, "response_time_ms"),
            read(page, "indexability_status"),
            read(page, "redirect_stop_reason"),
            number(page, "word_count"),
            page.get("issues")
                .and_then(Value::as_array)
                .map(Vec::len)
                .unwrap_or(0),
        ));
    }
}

pub fn append_issues_table(lines: &mut Vec<String>, pages: &[Value]) {
    lines.push("Issues table (all saved findings):".into());
    lines.push("Page URL | Severity | Message".into());
    for page in pages {
        if let Some(issues) = page.get("issues").and_then(Value::as_array) {
            for issue in issues {
                lines.push(format!(
                    "{} | {} | {}",
                    read(page, "url"),
                    issue
                        .get("severity")
                        .and_then(Value::as_str)
                        .unwrap_or("Info"),
                    issue.get("message").and_then(Value::as_str).unwrap_or("-"),
                ));
            }
        }
    }
}

pub fn append_links_table(lines: &mut Vec<String>, pages: &[Value]) {
    lines.push("Links table (all saved page links):".into());
    lines.push("Source URL | Target URL | HTTP | Anchor | Rel | Internal".into());
    for page in pages {
        if let Some(links) = page.get("links").and_then(Value::as_array) {
            for link in links {
                let target_status = link
                    .get("target_http_status")
                    .and_then(Value::as_i64)
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "-".into());
                let internal = link
                    .get("is_internal")
                    .and_then(Value::as_bool)
                    .map(|value| if value { "yes" } else { "no" })
                    .unwrap_or("-");
                lines.push(format!(
                    "{} | {} | {} | {} | {} | {}",
                    read(page, "url"),
                    link.get("target_url")
                        .and_then(Value::as_str)
                        .unwrap_or("-"),
                    target_status,
                    link.get("anchor_text")
                        .and_then(Value::as_str)
                        .unwrap_or("-"),
                    link.get("rel").and_then(Value::as_str).unwrap_or("-"),
                    internal,
                ));
            }
        }
    }
}

pub fn append_images_table(lines: &mut Vec<String>, pages: &[Value]) {
    lines.push("Images table (all saved page images):".into());
    lines.push("Page URL | Image source | ALT | HTTP | Bytes | Format | Lazy".into());
    for page in pages {
        if let Some(images) = page.get("images").and_then(Value::as_array) {
            for image in images {
                let lazy = image
                    .get("lazy_loaded")
                    .and_then(Value::as_bool)
                    .map(|value| if value { "yes" } else { "no" })
                    .unwrap_or("-");
                let number_or_dash = |key: &str| {
                    image
                        .get(key)
                        .and_then(Value::as_i64)
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "-".into())
                };
                lines.push(format!(
                    "{} | {} | {} | {} | {} | {} | {}",
                    read(page, "url"),
                    image.get("src").and_then(Value::as_str).unwrap_or("-"),
                    image.get("alt").and_then(Value::as_str).unwrap_or("-"),
                    number_or_dash("http_status"),
                    number_or_dash("content_length"),
                    image.get("format").and_then(Value::as_str).unwrap_or("-"),
                    lazy,
                ));
            }
        }
    }
}
