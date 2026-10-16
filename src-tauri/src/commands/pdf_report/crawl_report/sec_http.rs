use super::data::{f, list, Crawl};
use super::strings::{report as s, t, tf};
use super::tables::Table;

/// Response headers and how each URL was discovered.
pub fn http_details(c: &Crawl) -> Table {
    let rows: Vec<Vec<String>> = c
        .pages
        .iter()
        .map(|page| {
            let sources: Vec<String> = list(page, "discovery_sources")
                .iter()
                .map(|src| tf(t(s::DISCOVERED), &[&f(src, "kind"), &f(src, "source_url")]))
                .collect();
            vec![
                f(page, "url"),
                f(page, "content_type"),
                f(page, "content_encoding"),
                f(page, "cache_control"),
                f(page, "x_robots_tag"),
                sources.join("   "),
            ]
        })
        .filter(|row| row[1..].iter().any(|value| !value.is_empty()))
        .collect();
    let intro = tf(
        t(s::HTTP_INTRO),
        &[&rows.len().to_string(), &c.pages.len().to_string()],
    );
    let columns = [
        (t(s::COL_URL), 22.0),
        (t(s::COL_CONTENT_TYPE), 15.0),
        (t(s::COL_ENCODING), 9.0),
        (t(s::COL_CACHE), 16.0),
        (t(s::COL_XROBOTS), 12.0),
        (t(s::COL_DISCOVERED), 26.0),
    ];
    Table::text(t(s::T_HTTP), Some(intro), &columns, rows)
}
