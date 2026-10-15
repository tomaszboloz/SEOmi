use super::data::{flag, list, page_url, Crawl};
use super::metrics::is_broken;
use super::strings::{report as s, t, tf};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::field;
use serde_json::Value;
use std::collections::BTreeMap;

fn host_of(url: &str) -> String {
    let rest = url.split_once("://").map_or(url, |(_, rest)| rest);
    rest.split(['/', '?', '#'])
        .next()
        .unwrap_or_default()
        .to_owned()
}

fn link_state(link: &Value) -> String {
    match (
        field(link, "target_http_status"),
        field(link, "target_request_error_kind"),
    ) {
        (Some(status), Some(error)) => tf(t(s::STATUS_ERROR), &[&status, &error]),
        (Some(status), None) => status,
        (None, Some(error)) => error,
        (None, None) => String::new(),
    }
}

pub fn broken_links(c: &Crawl) -> Table {
    let mut rows: Vec<(bool, Vec<String>)> = Vec::new();
    for page in c.pages {
        for link in list(page, "links").iter().filter(|l| is_broken(l)) {
            let internal = flag(link, "is_internal");
            let kind = if internal {
                t(s::INTERNAL)
            } else {
                t(s::EXTERNAL)
            };
            rows.push((
                !internal,
                vec![
                    page_url(page),
                    field(link, "target_url").unwrap_or_default(),
                    link_state(link),
                    field(link, "anchor_text").unwrap_or_default(),
                    kind.into(),
                ],
            ));
        }
    }
    rows.sort_by_key(|(external, _)| *external);
    let columns = [
        (t(s::COL_SOURCE), 30.0),
        (t(s::COL_TARGET), 32.0),
        (t(s::COL_STATUS), 12.0),
        (t(s::COL_ANCHOR), 16.0),
        (t(s::COL_TYPE), 10.0),
    ];
    let rows = rows.into_iter().map(|(_, row)| row).collect();
    Table::text(
        t(s::T_BROKEN),
        Some(t(s::BROKEN_INTRO).into()),
        &columns,
        rows,
    )
}

pub fn external_links(c: &Crawl) -> Table {
    let mut hosts: BTreeMap<String, (usize, Vec<String>, Vec<String>)> = BTreeMap::new();
    for page in c.pages {
        for link in list(page, "links")
            .iter()
            .filter(|l| !flag(l, "is_internal"))
        {
            let entry = hosts
                .entry(host_of(&field(link, "target_url").unwrap_or_default()))
                .or_default();
            entry.0 += 1;
            let state = link_state(link);
            if !state.is_empty() && !entry.1.contains(&state) {
                entry.1.push(state);
            }
            let url = page_url(page);
            if !entry.2.contains(&url) {
                entry.2.push(url);
            }
        }
    }
    let rows = hosts
        .into_iter()
        .map(|(host, (count, states, pages))| {
            let checked = if states.is_empty() {
                t(s::NOT_CHECKED).to_owned()
            } else {
                states.join(", ")
            };
            vec![host, count.to_string(), pages.len().to_string(), checked]
        })
        .collect();
    let columns = [
        (t(s::COL_HOST), 40.0),
        (t(s::COL_LINKS), 12.0),
        (t(s::COL_PAGES), 12.0),
        (t(s::COL_STATES), 36.0),
    ];
    Table::text(
        t(s::T_EXTERNAL),
        Some(t(s::EXTERNAL_INTRO).into()),
        &columns,
        rows,
    )
}
