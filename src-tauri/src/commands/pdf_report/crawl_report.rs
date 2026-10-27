//! Styled crawl report built on the layout engine.

mod agg;
mod cover;
mod data;
mod detail_tables;
mod evidence;
mod focus_cards;
mod focus_tables;
mod focus_text;
mod issues;
mod kpis;
mod metrics;
mod pages;
mod recs;
mod run_tables;
mod sec_dupes;
mod sec_extra;
mod sec_focus;
mod sec_http;
mod sec_infogain;
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
mod tests_focus;
#[cfg(test)]
mod tests_focus_more;
#[cfg(test)]
mod tests_infogain;
#[cfg(test)]
mod tests_more;
#[cfg(test)]
mod tests_sections;

use super::audit_report::ctx::{field, pretty_time};
use super::layout::doc::{Chrome, Doc, CONTENT_W, MARGIN};
use super::layout::text::{Style, EMPTY};
use data::Crawl;
use serde_json::Value;
use strings::{report as s, t, tf};
use tables::Table;

fn coverage(tables: &[Table], sections: &[&Table]) -> Table {
    let mut rows: Vec<Vec<String>> = sections
        .iter()
        .copied()
        .chain(tables)
        .map(|table| {
            let count = table.rows.len() + table.omitted;
            let result = match count {
                0 => t(s::NONE_FOUND).to_owned(),
                1 => t(s::ROW_ONE).to_owned(),
                _ => tf(t(s::ROWS), &[&count.to_string()]),
            };
            vec![table.title.clone(), result]
        })
        .collect();
    rows.push(vec![t(s::T_COMPARISON).into(), t(s::NO_COMPARISON).into()]);
    let columns = [(t(s::COL_AREA), 45.0), (t(s::COL_RESULT), 55.0)];
    Table::text(
        t(s::T_COVERAGE),
        Some(t(s::COVERAGE_INTRO).into()),
        &columns,
        rows,
    )
}

pub fn crawl_pdf(run: &Value) -> Vec<u8> {
    let _labels = crate::commands::pdf_report::labels::enter(run);
    let c = Crawl::new(run);
    let chrome = Chrome {
        title: t(s::REPORT_TITLE).into(),
        subtitle: field(run, "scope_start_url").unwrap_or_default(),
        date: field(run, "completed_at").map_or_else(|| EMPTY.into(), |raw| pretty_time(&raw)),
        note: t(s::FOOTER_NOTE).into(),
        brand: t(s::BRAND_LINE).into(),
        page_label: t(s::PAGE_LABEL).into(),
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
        doc.heading(t(s::PAGES_HEADING));
        doc.data_table(&pages::pages_table(c.pages));
    }
    if detail_tables::allows(run, "issues") {
        doc.data_table(&pages::critical_table(c.pages));
    }
    let focus_table = sec_focus::present(run).then(|| {
        doc.crawl_focus(&run["focus"]);
        focus_tables::pages(&run["focus"])
    });
    let info_gain_table = sec_infogain::present(run).then(|| {
        doc.crawl_info_gain(&run["info_gain"]);
        sec_infogain::pages(&run["info_gain"])
    });
    doc.heading(t(s::DETAILS));
    let details = detail_tables::detail_tables(&c);
    details.iter().for_each(|table| doc.data_table(table));
    let sections: Vec<&Table> = focus_table.iter().chain(info_gain_table.iter()).collect();
    doc.data_table(&coverage(&details, &sections));
    doc.paragraph(MARGIN, CONTENT_W, Style::CAPTION, t(s::METHOD_FULL));
    doc.finish()
}
