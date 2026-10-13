//! Styled single-page audit report built on the layout engine.

mod check;
mod ctx;
mod detail;
mod issues;
mod kpi;
mod locate;
mod locate_evidence;
mod locate_tech;
mod model;
mod sections;
mod strings;
mod summary;

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
mod tests_sections;
#[cfg(test)]
mod tests_sections_gaps;

use super::layout::doc::{Chrome, Doc, CONTENT_W, MARGIN};
use super::layout::text::{Style, EMPTY};
use ctx::{pretty_time, Ctx};
use serde_json::Value;
use strings::report as s;

pub fn audit_pdf(audit: &Value) -> Vec<u8> {
    let ctx = Ctx {
        audit,
        findings: model::findings(audit),
    };
    let chrome = Chrome {
        title: s::REPORT_TITLE.into(),
        subtitle: ctx.text("/final_url").unwrap_or_default(),
        date: ctx
            .text("/timestamp")
            .map(|raw| pretty_time(&raw))
            .unwrap_or_else(|| EMPTY.into()),
        note: s::METHOD_NOTE.into(),
        brand: s::BRAND_LINE.into(),
        page_label: s::PAGE_LABEL.into(),
    };
    let mut doc = Doc::new(chrome);
    doc.summary(&ctx);
    doc.issues_section(&ctx);
    let sections = sections::build(&ctx);
    if sections.is_empty() {
        doc.heading(s::DETAILS);
        doc.paragraph(MARGIN, CONTENT_W, Style::BODY, s::NO_DETAILS);
    } else {
        doc.passed_checks(&sections);
        doc.details(&sections);
    }
    doc.finish()
}
