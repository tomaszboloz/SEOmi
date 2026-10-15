use super::data::{list, num, Crawl};
use super::strings::{report as s, t, tf};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::{field, format_number};
use crate::commands::pdf_report::layout::text::EMPTY;

fn hops(page: &serde_json::Value) -> String {
    list(page, "redirect_chain")
        .iter()
        .map(|hop| {
            let status = num(hop, "http_status").map_or_else(|| EMPTY.into(), format_number);
            tf(
                t(s::HOP),
                &[&status, &field(hop, "to_url").unwrap_or_default()],
            )
        })
        .collect::<Vec<_>>()
        .join("   ")
}

pub fn redirects(c: &Crawl) -> Table {
    let rows = c
        .pages
        .iter()
        .filter(|p| {
            !list(p, "redirect_chain").is_empty() || field(p, "redirect_stop_reason").is_some()
        })
        .map(|page| {
            vec![
                field(page, "url").unwrap_or_default(),
                list(page, "redirect_chain").len().to_string(),
                hops(page),
                field(page, "final_url").unwrap_or_default(),
                field(page, "redirect_stop_reason").unwrap_or_default(),
            ]
        })
        .collect();
    let columns = [
        (t(s::COL_URL), 22.0),
        (t(s::COL_HOPS), 6.0),
        (t(s::COL_CHAIN), 36.0),
        (t(s::COL_FINAL), 22.0),
        (t(s::COL_STOP), 14.0),
    ];
    Table::text(
        t(s::T_REDIRECTS),
        Some(t(s::REDIRECT_INTRO).into()),
        &columns,
        rows,
    )
}

pub fn client_redirects(c: &Crawl) -> Table {
    let mut rows = Vec::new();
    for page in c.pages {
        for redirect in list(page, "client_redirects") {
            rows.push(vec![
                field(page, "url").unwrap_or_default(),
                field(redirect, "source").unwrap_or_default(),
                field(redirect, "declaration").unwrap_or_default(),
                field(redirect, "target_url").unwrap_or_default(),
                field(redirect, "delay_seconds").unwrap_or_default(),
            ]);
        }
    }
    let columns = [
        (t(s::COL_URL), 28.0),
        (t(s::COL_SOURCE), 14.0),
        (t(s::COL_DECLARATION), 28.0),
        (t(s::COL_TARGET), 22.0),
        (t(s::COL_DELAY), 8.0),
    ];
    Table::text(t(s::T_CLIENT_REDIRECTS), None, &columns, rows)
}
