//! Internal link evidence (#70): anchor, DOM zone, ±15 words of context and the
//! section heading the crawler recorded. Older runs without these fields show a dash.
use super::data::{flag, list, page_url, Crawl};
use super::sec_link_zones::zone_label;
use super::strings::{report as s, t};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::field;

/// Rows kept in the PDF; the full list lives in the app and the CSV export.
pub const MAX_ROWS: usize = 40;

/// `before [anchor] after`, or empty when the crawler recorded no context.
pub fn context_cell(link: &serde_json::Value) -> String {
    let before = field(link, "context_before").unwrap_or_default();
    let after = field(link, "context_after").unwrap_or_default();
    if before.is_empty() && after.is_empty() {
        return String::new();
    }
    let anchor = field(link, "anchor_text").unwrap_or_default();
    [before, format!("[{anchor}]"), after]
        .iter()
        .filter(|part| !part.is_empty())
        .cloned()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn link_context(c: &Crawl) -> Table {
    let mut rows = Vec::new();
    let mut total = 0usize;
    for page in c.pages {
        for link in list(page, "links")
            .iter()
            .filter(|l| flag(l, "is_internal"))
        {
            total += 1;
            if rows.len() < MAX_ROWS {
                rows.push(vec![
                    page_url(page),
                    field(link, "target_url").unwrap_or_default(),
                    t(zone_label(link)).to_owned(),
                    context_cell(link),
                    field(link, "section_heading").unwrap_or_default(),
                ]);
            }
        }
    }
    let columns = [
        (t(s::COL_SOURCE), 20.0),
        (t(s::COL_TARGET), 20.0),
        (t(s::COL_ZONE), 12.0),
        (t(s::COL_CONTEXT), 32.0),
        (t(s::COL_SECTION), 16.0),
    ];
    let intro = format!("{} {}/{}", t(s::LINK_CONTEXT_INTRO), rows.len(), total);
    Table::text(t(s::T_LINK_CONTEXT), Some(intro), &columns, rows)
}
