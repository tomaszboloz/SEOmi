use super::cover::duration;
use super::data::{joined, list, Crawl};
use super::strings::{report as s, t};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::{field, format_number, pretty_time};
use crate::commands::pdf_report::layout::text::EMPTY;
use serde_json::Value;

const COLUMNS: [(&str, f32); 2] = [(s::COL_ITEM, 30.0), (s::COL_VALUE, 70.0)];

fn yes_no(flag: bool) -> String {
    if flag { s::YES } else { s::NO }.into()
}

/// Human readable form of any JSON value from the stored configuration.
pub fn display(value: &Value) -> String {
    match value {
        Value::Null => EMPTY.into(),
        Value::Bool(flag) => yes_no(*flag),
        Value::String(text) => text.clone(),
        Value::Number(number) => number.to_string(),
        Value::Array(items) if items.is_empty() => s::NONE.into(),
        Value::Array(items) => items.iter().map(display).collect::<Vec<_>>().join(", "),
        Value::Object(_) => value.to_string(),
    }
}

pub fn run_details(c: &Crawl) -> Table {
    let flag = |key: &str| yes_no(c.rflag(key));
    let truncated = c.r("storage_pages_total").map(|total| {
        t(
            s::STORAGE_PAGES,
            &[&c.r("pages_crawled").unwrap_or_default(), &total],
        )
    });
    let images: usize = c.pages.iter().map(|p| list(p, "images").len()).sum();
    let rows: Vec<(&str, String)> = vec![
        (s::RUN_ID, field(c.run, "id").unwrap_or_default()),
        (
            s::RD_COMPLETED,
            field(c.run, "completed_at")
                .map(|r| pretty_time(&r))
                .unwrap_or_default(),
        ),
        (
            s::SCOPE_URL,
            field(c.run, "scope_start_url").unwrap_or_default(),
        ),
        (s::START_URL, c.r("start_url").unwrap_or_default()),
        (
            s::RD_MODE,
            c.r("crawl_mode").unwrap_or_else(|| s::MODE_DEFAULT.into()),
        ),
        (s::RD_DURATION, duration(c.rnum("duration_ms"))),
        (
            s::RD_PAGES,
            c.rnum("pages_crawled")
                .map(format_number)
                .unwrap_or_default(),
        ),
        (s::RESOURCES, c.rlist("resources").len().to_string()),
        (s::IMAGES, images.to_string()),
        (
            s::LIMITS,
            joined(c.result, "limit_reasons", ", ").unwrap_or_else(|| s::NONE.into()),
        ),
        (s::CANCELLED, flag("cancelled")),
        (s::TIMED_OUT, flag("timed_out")),
        (s::RESOURCE_LIMIT, flag("resource_limit_reached")),
        (s::PROVENANCE, flag("discovery_provenance_truncated")),
        (
            s::COMPACTED,
            yes_no(c.run.get("storage_compacted").and_then(Value::as_bool) == Some(true)),
        ),
        (
            s::PAGES_TRUNCATED,
            if c.rflag("storage_pages_truncated") {
                truncated.unwrap_or_default()
            } else {
                s::NO.into()
            },
        ),
        (
            s::TEMPLATE,
            field(c.run, "report_template_name").unwrap_or_else(|| s::TEMPLATE_FULL.into()),
        ),
    ];
    let rows = rows
        .into_iter()
        .map(|(k, v)| vec![k.to_owned(), v])
        .collect();
    Table::text(s::T_RUN, None, &COLUMNS, rows)
}

pub fn configuration(c: &Crawl) -> Table {
    let rows = match c.run.get("configuration").and_then(Value::as_object) {
        Some(map) if !map.is_empty() => map
            .iter()
            .map(|(k, v)| vec![k.clone(), display(v)])
            .collect(),
        _ => vec![vec![s::T_CONFIG.to_owned(), String::new()]],
    };
    Table::text(s::T_CONFIG, Some(s::CONFIG_INTRO.into()), &COLUMNS, rows)
}

pub fn robots_sitemap(c: &Crawl) -> Table {
    let r = |key: &str| c.r(key).unwrap_or_default();
    let rows: Vec<(&str, String)> = vec![
        (s::ROBOTS_STATUS, r("robots_txt_status")),
        (s::ROBOTS_EVAL, r("robots_txt_evaluation_status")),
        (s::ROBOTS_CODE, r("robots_txt_status_code")),
        (s::ROBOTS_URL, r("robots_txt_final_url")),
        (s::ROBOTS_AGENT, r("robots_user_agent")),
        (s::ROBOTS_BLOCKED, r("robots_blocked_count")),
        (s::ROBOTS_WARNING, r("robots_txt_warning")),
        (s::SITEMAP_STATUS, r("sitemap_status")),
        (s::SITEMAP_FOUND, r("sitemap_urls_discovered")),
    ];
    let rows = rows
        .into_iter()
        .map(|(k, v)| vec![k.to_owned(), v])
        .collect();
    Table::text(s::T_ROBOTS, None, &COLUMNS, rows)
}
