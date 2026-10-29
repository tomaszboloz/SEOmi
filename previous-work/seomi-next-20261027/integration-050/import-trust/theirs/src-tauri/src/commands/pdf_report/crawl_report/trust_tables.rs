//! Tables of the Entity Trust section.

use super::data::list;
use super::focus_text::{arg, coded, from_params, percent};
use super::strings::trust::{self as k, FIND, FINDINGS, KIND, KINDS, SEVERITY};
use super::strings::{t, tf};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::field;
use serde_json::Value;

/// Prioritised findings with their severity.
pub fn findings(trust: &Value) -> Table {
    let rows = list(trust, "findings")
        .iter()
        .map(|item| {
            let code = field(item, "code").unwrap_or_default();
            vec![
                coded(SEVERITY, &field(item, "severity").unwrap_or_default(), &[]),
                from_params(FIND, FINDINGS, &code, item.get("params")),
            ]
        })
        .collect();
    let columns = [(t(k::COL_SEVERITY), 16.0), (t(k::COL_FINDING), 84.0)];
    Table::text(
        t(k::T_FINDINGS),
        Some(t(k::FINDINGS_INTRO).into()),
        &columns,
        rows,
    )
}

/// Author entities with their sameAs links and topic alignment.
pub fn authors(trust: &Value) -> Table {
    let rows = list(trust, "authors")
        .iter()
        .map(|author| {
            let generic = author.get("generic").and_then(Value::as_bool) == Some(true);
            let name = arg(author.get("name"));
            vec![
                if generic {
                    tf(t(k::GENERIC), &[&name])
                } else {
                    name
                },
                arg(author.get("articles")),
                arg(author.get("same_as")),
                author
                    .get("alignment")
                    .filter(|v| !v.is_null())
                    .map_or_else(|| arg(None), |v| percent(Some(v))),
                arg(author.get("profile_status")),
            ]
        })
        .collect();
    let columns = [
        (t(k::COL_AUTHOR), 46.0),
        (t(k::COL_ARTICLES), 18.0),
        (t(k::COL_SAME_AS), 18.0),
        (t(k::COL_ALIGNMENT), 18.0),
        (t(k::COL_PROFILE), 24.0),
    ];
    Table::text(
        t(k::T_AUTHORS),
        Some(t(k::AUTHORS_INTRO).into()),
        &columns,
        rows,
    )
}

/// Trust pages the crawl did or did not find.
pub fn pages(trust: &Value) -> Table {
    let rows = KINDS
        .iter()
        .map(|kind| {
            let url = trust
                .pointer(&format!("/pages/{kind}"))
                .and_then(Value::as_str);
            vec![
                coded(KIND, kind, &[]),
                url.map_or_else(|| t(k::MISSING).to_owned(), |u| tf(t(k::FOUND), &[u])),
            ]
        })
        .collect();
    let columns = [(t(k::COL_PAGE), 30.0), (t(k::COL_STATE), 70.0)];
    Table::text(
        t(k::T_PAGES),
        Some(t(k::PAGES_INTRO).into()),
        &columns,
        rows,
    )
}

/// Bounded claim-to-citation evidence; association never becomes manual verification.
pub fn claims(trust: &Value) -> Table {
    let rows = list(trust, "claims")
        .iter()
        .map(|claim| {
            vec![
                arg(claim.get("claim")),
                arg(claim.get("relation")),
                arg(claim.get("evidence")),
                arg(claim.get("source_checked")),
            ]
        })
        .collect();
    let columns = [
        (t(k::COL_CLAIM), 52.0),
        (t(k::COL_RELATION), 16.0),
        (t(k::COL_EVIDENCE), 18.0),
        (t(k::COL_CHECKED), 14.0),
    ];
    Table::text(
        t(k::T_CLAIMS),
        Some(t(k::CLAIMS_INTRO).into()),
        &columns,
        rows,
    )
}
