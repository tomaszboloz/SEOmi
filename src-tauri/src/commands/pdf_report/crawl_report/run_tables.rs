use super::cover::duration;
use super::data::{joined, list, Crawl};
use super::strings::{report as s, t, tf};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::{field, format_number, pretty_time};
use crate::commands::pdf_report::layout::text::EMPTY;
use serde_json::Value;

fn columns() -> [(&'static str, f32); 2] {
    [(t(s::COL_ITEM), 30.0), (t(s::COL_VALUE), 70.0)]
}

fn yes_no(flag: bool) -> String {
    if flag { t(s::YES) } else { t(s::NO) }.into()
}

/// Human readable form of any JSON value from the stored configuration.
pub fn display(value: &Value) -> String {
    match value {
        Value::Null => EMPTY.into(),
        Value::Bool(flag) => yes_no(*flag),
        Value::String(text) => text.clone(),
        Value::Number(number) => number.to_string(),
        Value::Array(items) if items.is_empty() => t(s::NONE).into(),
        Value::Array(items) => items.iter().map(display).collect::<Vec<_>>().join(", "),
        Value::Object(_) => value.to_string(),
    }
}

pub fn run_details(c: &Crawl) -> Table {
    let flag = |key: &str| yes_no(c.rflag(key));
    let truncated = c.r("storage_pages_total").map(|total| {
        tf(
            t(s::STORAGE_PAGES),
            &[&c.r("pages_crawled").unwrap_or_default(), &total],
        )
    });
    let images: usize = c.pages.iter().map(|p| list(p, "images").len()).sum();
    let rows: Vec<(&str, String)> = vec![
        (t(s::RUN_ID), field(c.run, "id").unwrap_or_default()),
        (
            t(s::RD_COMPLETED),
            field(c.run, "completed_at")
                .map(|r| pretty_time(&r))
                .unwrap_or_default(),
        ),
        (
            t(s::SCOPE_URL),
            field(c.run, "scope_start_url").unwrap_or_default(),
        ),
        (t(s::START_URL), c.r("start_url").unwrap_or_default()),
        (
            t(s::RD_MODE),
            c.r("crawl_mode")
                .unwrap_or_else(|| t(s::MODE_DEFAULT).into()),
        ),
        (t(s::RD_DURATION), duration(c.rnum("duration_ms"))),
        (
            t(s::RD_PAGES),
            c.rnum("pages_crawled")
                .map(format_number)
                .unwrap_or_default(),
        ),
        (t(s::RESOURCES), c.rlist("resources").len().to_string()),
        (t(s::IMAGES), images.to_string()),
        (
            t(s::LIMITS),
            joined(c.result, "limit_reasons", ", ").unwrap_or_else(|| t(s::NONE).into()),
        ),
        (t(s::CANCELLED), flag("cancelled")),
        (t(s::TIMED_OUT), flag("timed_out")),
        (t(s::RESOURCE_LIMIT), flag("resource_limit_reached")),
        (t(s::PROVENANCE), flag("discovery_provenance_truncated")),
        (
            t(s::COMPACTED),
            yes_no(c.run.get("storage_compacted").and_then(Value::as_bool) == Some(true)),
        ),
        (
            t(s::PAGES_TRUNCATED),
            if c.rflag("storage_pages_truncated") {
                truncated.unwrap_or_default()
            } else {
                t(s::NO).into()
            },
        ),
        (
            t(s::TEMPLATE),
            field(c.run, "report_template_name").unwrap_or_else(|| t(s::TEMPLATE_FULL).into()),
        ),
    ];
    let rows = rows
        .into_iter()
        .map(|(k, v)| vec![k.to_owned(), v])
        .collect();
    Table::text(t(s::T_RUN), None, &columns(), rows)
}

pub fn configuration(c: &Crawl) -> Table {
    let rows = match c.run.get("configuration").and_then(Value::as_object) {
        Some(map) if !map.is_empty() => map
            .iter()
            .map(|(k, v)| vec![k.clone(), display(v)])
            .collect(),
        _ => vec![vec![t(s::T_CONFIG).to_owned(), String::new()]],
    };
    Table::text(
        t(s::T_CONFIG),
        Some(t(s::CONFIG_INTRO).into()),
        &columns(),
        rows,
    )
}

pub fn robots_sitemap(c: &Crawl) -> Table {
    let r = |key: &str| c.r(key).unwrap_or_default();
    let rows: Vec<(&str, String)> = vec![
        (t(s::ROBOTS_STATUS), r("robots_txt_status")),
        (t(s::ROBOTS_EVAL), r("robots_txt_evaluation_status")),
        (t(s::ROBOTS_CODE), r("robots_txt_status_code")),
        (t(s::ROBOTS_URL), r("robots_txt_final_url")),
        (t(s::ROBOTS_AGENT), r("robots_user_agent")),
        (t(s::ROBOTS_BLOCKED), r("robots_blocked_count")),
        (t(s::ROBOTS_WARNING), r("robots_txt_warning")),
        (t(s::SITEMAP_STATUS), r("sitemap_status")),
        (t(s::SITEMAP_FOUND), r("sitemap_urls_discovered")),
    ];
    let rows = rows
        .into_iter()
        .map(|(k, v)| vec![k.to_owned(), v])
        .collect();
    Table::text(t(s::T_ROBOTS), None, &columns(), rows)
}
