//! Styled single-page audit report built on the layout engine.

mod check;
pub(super) mod ctx;
mod detail;
mod issues;
mod kpi;
mod locate;
mod locate_evidence;
mod locate_tech;
pub(super) mod model;
mod sections;
pub(super) mod strings;
mod summary;

#[cfg(test)]
#[path = "audit_report/coverage100_tests.rs"]
mod coverage100_tests;
#[cfg(test)]
mod fixture;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_checks;
#[cfg(test)]
mod tests_locate;
#[cfg(test)]
mod tests_locate_tech;
#[cfg(test)]
mod tests_model;
#[cfg(test)]
mod tests_phrase;
#[cfg(test)]
mod tests_phrase_previous;
#[cfg(test)]
mod tests_sections;
#[cfg(test)]
mod tests_sections_gaps;

use super::layout::doc::{Chrome, Doc, CONTENT_W, MARGIN};
use super::layout::text::{Style, EMPTY};
use ctx::{pretty_time, Ctx};
use serde_json::Value;
use strings::{report as s, t};

pub fn audit_pdf(audit: &Value) -> Vec<u8> {
    let _labels = super::labels::enter(audit);
    let ctx = Ctx {
        audit,
        findings: model::findings(audit),
    };
    let chrome = Chrome {
        title: t(s::REPORT_TITLE).into(),
        subtitle: ctx.text("/final_url").unwrap_or_default(),
        date: ctx
            .text("/timestamp")
            .map(|raw| pretty_time(&raw))
            .unwrap_or_else(|| EMPTY.into()),
        note: t(s::METHOD_NOTE).into(),
        brand: t(s::BRAND_LINE).into(),
        page_label: t(s::PAGE_LABEL).into(),
    };
    let mut doc = Doc::new(chrome);
    doc.summary(&ctx);
    doc.issues_section(&ctx);
    let sections = sections::build(&ctx);
    if sections.is_empty() {
        doc.heading(t(s::DETAILS));
        doc.paragraph(MARGIN, CONTENT_W, Style::BODY, t(s::NO_DETAILS));
    } else {
        doc.passed_checks(&sections);
        doc.details(&sections);
    }
    doc.finish()
}
