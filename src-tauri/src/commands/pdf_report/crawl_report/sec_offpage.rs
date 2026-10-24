use super::data::{f, OffPage};
use super::focus_text::coded;
use super::offpage_tables::{bounded, citations, sources, value};
use super::strings::{offpage as o, t};
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::Style;
use serde_json::Value;

impl Doc {
    pub fn crawl_off_page(&mut self, off_page: &OffPage) {
        let data = off_page.summary;
        self.heading(t(o::TITLE));
        self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, t(o::INTRO));
        self.facts_row(&[
            (t(o::TOPIC), value(data, "topic_label")),
            (t(o::SCALE), value(data, "scale")),
            (
                t(o::MODEL),
                format!(
                    "{} / {}",
                    value(data, "embedding_provider"),
                    value(data, "embedding_model_id")
                ),
            ),
        ]);
        self.facts_row(&[
            (t(o::REQUESTED), value(data, "sources_requested")),
            (t(o::FETCHED), value(data, "sources_fetched")),
            (t(o::SCORED), value(data, "sources_scored")),
        ]);
        self.facts_row(&[
            (t(o::TBVA), value(off_page.tbva, "value")),
            (
                t(o::STATUS_LABEL),
                coded(o::STATUS, &f(off_page.tbva, "status"), &[]),
            ),
        ]);
        for code in super::data::list(off_page.tbva, "limitations")
            .iter()
            .filter_map(Value::as_str)
        {
            let text = format!(
                "{}: {}",
                t(o::LIMITATIONS_LABEL),
                coded(o::LIMITATIONS, code, &[])
            );
            self.paragraph(MARGIN, CONTENT_W, Style::BODY, &bounded(&text, 400));
        }
        self.data_table(&sources(off_page));
        if !off_page.co_citations.is_empty() {
            self.data_table(&citations(off_page));
        }
        self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, t(o::DISCLAIMER));
    }
}

pub fn present(run: &Value) -> bool {
    run.get("offPage").is_some_and(Value::is_object) && super::detail_tables::allows(run, "offPage")
}
