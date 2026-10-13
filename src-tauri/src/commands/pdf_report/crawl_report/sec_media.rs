use super::data::{f, list, num, Crawl};
use super::strings::{report as s, t};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::{field, format_number};
use serde_json::Value;

/// Images larger than this many bytes are reported as oversized.
pub const OVERSIZED_BYTES: f64 = 200_000.0;

pub fn image_problems(image: &Value) -> Vec<String> {
    let mut problems = Vec::new();
    if image.get("alt").and_then(Value::as_str).is_none() {
        problems.push(s::P_NO_ALT.to_owned());
    }
    if num(image, "width").is_none() || num(image, "height").is_none() {
        problems.push(s::P_NO_SIZE.to_owned());
    }
    if num(image, "http_status").is_some_and(|code| code >= 400.0)
        || field(image, "request_error_kind").is_some()
    {
        problems.push(s::P_BROKEN.to_owned());
    }
    if num(image, "content_length").is_some_and(|bytes| bytes > OVERSIZED_BYTES) {
        problems.push(t(
            s::P_OVERSIZED,
            &[&format_number(OVERSIZED_BYTES / 1000.0)],
        ));
    }
    problems
}

pub fn images(c: &Crawl) -> Table {
    let total: usize = c.pages.iter().map(|p| list(p, "images").len()).sum();
    let mut rows = Vec::new();
    for page in c.pages {
        for image in list(page, "images") {
            let problems = image_problems(image);
            if problems.is_empty() {
                continue;
            }
            let size = match (field(image, "width"), field(image, "height")) {
                (Some(w), Some(h)) => format!("{w}x{h}"),
                _ => String::new(),
            };
            let status = field(image, "http_status")
                .or_else(|| field(image, "request_error_kind"))
                .unwrap_or_default();
            rows.push(vec![
                f(page, "url"),
                f(image, "src"),
                f(image, "alt"),
                size,
                f(image, "content_length"),
                status,
                problems.join(", "),
            ]);
        }
    }
    let intro = t(
        s::IMAGES_INTRO,
        &[&rows.len().to_string(), &total.to_string()],
    );
    let columns = [
        (s::COL_URL, 20.0),
        (s::COL_IMAGE, 25.0),
        (s::COL_ALT, 12.0),
        (s::COL_SIZE, 9.0),
        (s::COL_BYTES, 8.0),
        (s::COL_STATUS, 8.0),
        (s::COL_PROBLEM, 18.0),
    ];
    Table::text(s::T_IMAGES, Some(intro), &columns, rows)
}

pub fn resources(c: &Crawl) -> Table {
    let rows = c
        .rlist("resources")
        .iter()
        .map(|res| {
            let used = list(res, "source_urls")
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>();
            let used_by = t(
                s::USED_BY,
                &[
                    &used.len().to_string(),
                    used.first().copied().unwrap_or_default(),
                ],
            );
            vec![
                f(res, "url"),
                f(res, "resource_type"),
                f(res, "http_status"),
                f(res, "content_type"),
                f(res, "content_length"),
                f(res, "response_time_ms"),
                used_by,
            ]
        })
        .collect();
    let columns = [
        (s::COL_RESOURCE, 30.0),
        (s::COL_TYPE, 9.0),
        (s::COL_STATUS, 8.0),
        (s::COL_CONTENT_TYPE, 14.0),
        (s::COL_BYTES, 8.0),
        (s::COL_TIME, 8.0),
        (s::COL_USED_BY, 23.0),
    ];
    Table::text(s::T_RESOURCES, None, &columns, rows)
}
