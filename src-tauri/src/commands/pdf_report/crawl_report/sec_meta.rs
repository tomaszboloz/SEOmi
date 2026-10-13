use super::data::{f, flag, list, Crawl};
use super::strings::{report as s, t};
use super::tables::Table;
use crate::commands::pdf_report::layout::text::{dash, EMPTY};
use serde_json::Value;

pub(super) fn tri(value: &Value, key: &str) -> String {
    match value.get(key).and_then(Value::as_bool) {
        Some(true) => s::YES,
        Some(false) => s::NO,
        None => EMPTY,
    }
    .into()
}

pub fn canonicals(c: &Crawl) -> Table {
    let rows = c
        .pages
        .iter()
        .filter(|p| f(p, "canonical_relation") != "self" || flag(p, "canonical_robots_conflict"))
        .map(|page| {
            let targets: Vec<String> = list(page, "canonical_targets")
                .iter()
                .map(|target| {
                    t(
                        s::TARGET_STATUS,
                        &[&f(target, "url"), &dash(&f(target, "http_status"))],
                    )
                })
                .collect();
            let conflict = if flag(page, "canonical_robots_conflict") {
                s::YES
            } else {
                s::NO
            };
            vec![
                f(page, "url"),
                targets.join("   "),
                f(page, "canonical_relation"),
                f(page, "canonical_declaration_count"),
                conflict.into(),
            ]
        })
        .collect();
    let columns = [
        (s::COL_URL, 26.0),
        (s::COL_CANONICAL, 36.0),
        (s::COL_RELATION, 14.0),
        (s::COL_DECLARATIONS, 11.0),
        (s::COL_CONFLICT, 13.0),
    ];
    Table::text(
        s::T_CANONICAL,
        Some(s::CANONICAL_INTRO.into()),
        &columns,
        rows,
    )
}

pub fn hreflang(c: &Crawl) -> Table {
    let mut rows = Vec::new();
    for page in c.pages {
        for tag in list(page, "hreflangs") {
            let problem = f(tag, "target_http_status")
                .parse::<u32>()
                .is_ok_and(|code| code >= 400)
                || tag.get("reciprocal_in_run").and_then(Value::as_bool) == Some(false);
            let verdict = if problem { s::PROBLEM } else { s::OK };
            rows.push(vec![
                f(page, "url"),
                f(tag, "language"),
                f(tag, "target_url"),
                f(tag, "target_http_status"),
                tri(tag, "reciprocal_in_run"),
                verdict.into(),
            ]);
        }
    }
    let columns = [
        (s::COL_URL, 26.0),
        (s::COL_LANG, 8.0),
        (s::COL_TARGET, 34.0),
        (s::COL_STATUS, 9.0),
        (s::COL_RECIPROCAL, 11.0),
        (s::COL_VERDICT, 12.0),
    ];
    Table::text(s::T_HREFLANG, None, &columns, rows)
}
