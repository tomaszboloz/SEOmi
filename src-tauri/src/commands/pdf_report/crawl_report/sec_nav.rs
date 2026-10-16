use super::data::{f, list, Crawl};
use super::sec_meta::tri;
use super::strings::{report as s, t};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::field;
use serde_json::Value;

pub fn pagination(c: &Crawl) -> Table {
    let mut rows = Vec::new();
    for page in c.pages {
        for link in list(page, "pagination_links") {
            let changes = link
                .get("query_parameter_changes")
                .and_then(Value::as_array);
            let changed = changes.map(|v| {
                v.iter()
                    .filter_map(Value::as_str)
                    .collect::<Vec<_>>()
                    .join(", ")
            });
            rows.push(vec![
                f(page, "url"),
                f(link, "relation"),
                f(link, "target_url"),
                f(link, "http_status"),
                tri(link, "reciprocal_in_run"),
                changed.unwrap_or_default(),
                f(page, "pagination_canonical_alignment"),
            ]);
        }
    }
    let columns = [
        (t(s::COL_URL), 22.0),
        (t(s::COL_RELATION), 8.0),
        (t(s::COL_TARGET), 28.0),
        (t(s::COL_STATUS), 8.0),
        (t(s::COL_RECIPROCAL), 10.0),
        (t(s::COL_PARAMS), 12.0),
        (t(s::COL_ALIGNMENT), 12.0),
    ];
    Table::text(t(s::T_PAGINATION), None, &columns, rows)
}

pub fn amp(c: &Crawl) -> Table {
    let rows = c
        .pages
        .iter()
        .filter(|p| field(p, "amp_url").is_some())
        .map(|page| {
            vec![
                f(page, "url"),
                f(page, "amp_url"),
                f(page, "amp_target_http_status"),
                tri(page, "amp_target_checked_in_run"),
                f(page, "amp_target_canonical_alignment"),
            ]
        })
        .collect();
    let columns = [
        (t(s::COL_URL), 28.0),
        (t(s::COL_AMP), 30.0),
        (t(s::COL_STATUS), 10.0),
        (t(s::COL_CHECKED), 12.0),
        (t(s::COL_ALIGNMENT), 20.0),
    ];
    Table::text(t(s::T_AMP), None, &columns, rows)
}
