use super::data::{list, page_url, Crawl};
use super::metrics::duplicate_groups;
use super::strings::{report as s, t, tf};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::field;

fn group_columns() -> [(&'static str, f32); 3] {
    [
        (t(s::COL_VALUE), 34.0),
        (t(s::COL_PAGES), 8.0),
        (t(s::COL_URLS), 58.0),
    ]
}

fn groups(c: &Crawl, key: &str, title: &str, shorten: bool) -> Table {
    let rows = duplicate_groups(c.pages, key)
        .into_iter()
        .map(|(value, members)| {
            let urls: Vec<String> = members.iter().map(|&i| page_url(&c.pages[i])).collect();
            let shown = if shorten {
                let label = field(&c.pages[members[0]], "title").unwrap_or_default();
                tf(
                    t(s::HASH_LABEL),
                    &[&value.chars().take(12).collect::<String>(), &label],
                )
            } else {
                value
            };
            vec![shown, members.len().to_string(), urls.join("   ")]
        })
        .collect();
    Table::text(title, Some(t(s::DUP_INTRO).into()), &group_columns(), rows)
}

fn near_duplicates(c: &Crawl) -> Table {
    let mut rows = Vec::new();
    for page in c.pages {
        for issue in list(page, "issues") {
            let message = field(issue, "message").unwrap_or_default();
            if message.to_lowercase().contains("near-duplicate") {
                rows.push(vec![page_url(page), message]);
            }
        }
    }
    let columns = [(t(s::COL_URL), 40.0), (t(s::COL_FINDING), 60.0)];
    Table::text(t(s::T_NEAR), None, &columns, rows)
}

pub fn duplicates(c: &Crawl) -> Vec<Table> {
    vec![
        groups(c, "title", t(s::T_DUP_TITLES), false),
        groups(c, "meta_description", t(s::T_DUP_DESCRIPTIONS), false),
        groups(c, "content_hash", t(s::T_DUP_CONTENT), true),
        near_duplicates(c),
    ]
}
