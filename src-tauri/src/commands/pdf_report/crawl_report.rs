//! Styled crawl report built on the layout engine.

mod agg;
mod cover;
mod data;
mod detail_tables;
mod evidence;
mod issues;
mod kpis;
mod metrics;
mod pages;
mod recs;
mod run_tables;
mod sec_dupes;
mod sec_extra;
mod sec_http;
mod sec_links;
mod sec_media;
mod sec_meta;
mod sec_nav;
mod sec_redirects;
mod sec_robots;
mod sec_schema;
mod strings;
mod tables;

#[cfg(test)]
mod fixture;
#[cfg(test)]
mod fixture_run;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_agg;
#[cfg(test)]
mod tests_data;
#[cfg(test)]
mod tests_more;
#[cfg(test)]
mod tests_sections;

use super::audit_report::ctx::{field, pretty_time};
use super::layout::doc::{Chrome, Doc, CONTENT_W, MARGIN};
use super::layout::text::{Style, EMPTY};
use data::Crawl;
use serde_json::Value;
use strings::{report as s, t};
use tables::Table;

fn coverage(tables: &[Table]) -> Table {
    let mut rows: Vec<Vec<String>> = tables
        .iter()
        .map(|table| {
            let count = table.rows.len() + table.omitted;
            let result = match count {
                0 => s::NONE_FOUND.to_owned(),
                1 => s::ROW_ONE.to_owned(),
                _ => t(s::ROWS, &[&count.to_string()]),
            };
            vec![table.title.clone(), result]
        })
        .collect();
    rows.push(vec![s::T_COMPARISON.into(), s::NO_COMPARISON.into()]);
    let columns = [(s::COL_AREA, 45.0), (s::COL_RESULT, 55.0)];
    Table::text(
        s::T_COVERAGE,
        Some(s::COVERAGE_INTRO.into()),
        &columns,
        rows,
    )
}

pub fn crawl_pdf(run: &Value) -> Vec<u8> {
    let c = Crawl::new(run);
    let chrome = Chrome {
        title: s::REPORT_TITLE.into(),
        subtitle: field(run, "scope_start_url").unwrap_or_default(),
        date: field(run, "completed_at").map_or_else(|| EMPTY.into(), |raw| pretty_time(&raw)),
        note: s::FOOTER_NOTE.into(),
        brand: s::BRAND_LINE.into(),
        page_label: s::PAGE_LABEL.into(),
    };
    let mut doc = Doc::new(chrome);
    doc.crawl_cover(&c);
    doc.data_table(&run_tables::run_details(&c));
    if detail_tables::allows(run, "configuration") {
        doc.data_table(&run_tables::configuration(&c));
    }
    doc.data_table(&run_tables::robots_sitemap(&c));
    if detail_tables::allows(run, "issues") {
        doc.crawl_issues(&agg::aggregate(c.pages), c.pages.len());
    }
    if detail_tables::allows(run, "pages") {
        doc.heading(s::PAGES_HEADING);
        doc.data_table(&pages::pages_table(c.pages));
    }
    if detail_tables::allows(run, "issues") {
        doc.data_table(&pages::critical_table(c.pages));
    }
    doc.heading(s::DETAILS);
    let details = detail_tables::detail_tables(&c);
    details.iter().for_each(|table| doc.data_table(table));
    doc.data_table(&coverage(&details));
    doc.paragraph(MARGIN, CONTENT_W, Style::CAPTION, s::METHOD_FULL);
    doc.finish()
}
