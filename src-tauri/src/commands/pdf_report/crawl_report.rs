//! Styled crawl report built on the layout engine.

mod agg;
mod aio_tables;
mod authority_tables;
mod cover;
mod coverage;
mod data;
mod detail_tables;
mod evidence;
mod focus_brand;
mod focus_cards;
mod focus_protection;
mod focus_segments;
mod focus_tables;
mod focus_text;
mod issues;
mod kpis;
mod metrics;
mod offpage_tables;
mod pages;
mod recs;
mod run_tables;
mod sec_aio;
mod sec_authority;
mod sec_dupes;
mod sec_extra;
mod sec_focus;
mod sec_http;
mod sec_link_zones;
mod sec_links;
mod sec_media;
mod sec_meta;
mod sec_nav;
mod sec_offpage;
mod sec_redirects;
mod sec_robots;
mod sec_schema;
mod sec_trust;
mod strings;
mod tables;
mod trust_profile;
mod trust_tables;

#[cfg(test)]
#[path = "crawl_report/coverage100_tests.rs"]
mod coverage100_tests;
#[cfg(test)]
mod fixture;
#[cfg(test)]
mod fixture_run;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_agg;
#[cfg(test)]
mod tests_aio;
#[cfg(test)]
mod tests_authority;
#[cfg(test)]
mod tests_data;
#[cfg(test)]
mod tests_focus;
#[cfg(test)]
mod tests_focus_brand;
#[cfg(test)]
mod tests_focus_more;
#[cfg(test)]
mod tests_focus_protection;
#[cfg(test)]
mod tests_focus_segments;
#[cfg(test)]
mod tests_link_zones;
#[cfg(test)]
mod tests_more;
#[cfg(test)]
mod tests_offpage;
#[cfg(test)]
mod tests_offpage_edges;
#[cfg(test)]
mod tests_sections;
#[cfg(test)]
mod tests_trust;

use super::audit_report::ctx::{field, pretty_time};
use super::layout::doc::{Chrome, Doc, CONTENT_W, MARGIN};
use super::layout::text::{Style, EMPTY};
use coverage::coverage;
use data::Crawl;
use serde_json::Value;
use strings::{report as s, t};

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
    let mut sections = Vec::new();
    if sec_focus::present(run) {
        doc.crawl_focus(&run["focus"]);
        sections.push(focus_tables::pages(&run["focus"]));
    }
    if sec_authority::present(run) {
        doc.crawl_authority(&run["authority"]);
    }
    if sec_aio::present(run) {
        doc.crawl_aio(&run["aio"]);
    }
    if sec_offpage::present(run) {
        let off_page = data::OffPage::new(&run["offPage"]);
        doc.crawl_off_page(&off_page);
        sections.push(offpage_tables::sources(&off_page));
    }
    if sec_trust::present(run) {
        doc.crawl_trust(&run["trust"]);
        sections.push(trust_tables::findings(&run["trust"]));
    }
    doc.heading(t(s::DETAILS));
    let details = detail_tables::detail_tables(&c);
    details.iter().for_each(|table| doc.data_table(table));
    doc.data_table(&coverage(&details, &sections));
    doc.paragraph(MARGIN, CONTENT_W, Style::CAPTION, t(s::METHOD_FULL));
    doc.finish()
}
