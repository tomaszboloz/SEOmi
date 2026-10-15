use super::agg::IssueType;
use super::strings::{report as s, t, tf};
use crate::commands::pdf_report::audit_report::model::Sev;
use crate::commands::pdf_report::layout::card::{Card, CardRow};
use crate::commands::pdf_report::layout::color::OK;
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::Style;

/// Affected pages listed per finding before "+ N more pages".
pub const LISTED_PAGES: usize = 8;

pub fn sev_label(sev: Sev) -> &'static str {
    match sev {
        Sev::Critical => t(s::CRITICAL),
        Sev::Warning => t(s::WARNING),
        Sev::Info => t(s::NOTICE),
    }
}

fn card_for(item: &IssueType, total: usize) -> Card {
    let count = item.pages.len();
    let percent = (count * 100).checked_div(total).unwrap_or(0);
    let mut where_items: Vec<String> = item
        .pages
        .iter()
        .take(LISTED_PAGES)
        .map(|(_, url, evidence)| {
            if evidence.is_empty() {
                url.clone()
            } else {
                tf(t(s::WHERE_PAGE), &[url, evidence])
            }
        })
        .collect();
    if count > LISTED_PAGES {
        where_items.push(tf(t(s::MORE_PAGES), &[&(count - LISTED_PAGES).to_string()]));
    }
    Card {
        accent: item.sev.color(),
        badge: sev_label(item.sev).to_uppercase(),
        meta: if count == 1 {
            t(s::AFFECTED_ONE).into()
        } else {
            tf(t(s::AFFECTED), &[&count.to_string(), &percent.to_string()])
        },
        tag: item.code.clone().unwrap_or_default(),
        headline: item.headline.clone(),
        rows: vec![
            CardRow {
                label: t(s::WHERE).into(),
                items: where_items,
            },
            CardRow {
                label: t(s::HOW_TO_FIX).into(),
                items: vec![item.advice.clone()],
            },
        ],
    }
}

impl Doc {
    pub fn crawl_issues(&mut self, types: &[IssueType], total: usize) {
        self.ensure(260.0);
        self.heading(t(s::FIX_FIRST));
        if types.is_empty() {
            self.paragraph(
                MARGIN,
                CONTENT_W,
                Style::BODY.colored(OK).bold(),
                t(s::NO_ISSUES),
            );
            return self.skip(10.0);
        }
        self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, t(s::FIX_INTRO));
        self.skip(6.0);
        let mut current = None;
        for item in types {
            if current != Some(item.sev) {
                let count = types.iter().filter(|other| other.sev == item.sev).count();
                self.ensure(200.0);
                let label = tf(
                    t(s::SEVERITY_GROUP),
                    &[sev_label(item.sev), &count.to_string()],
                );
                self.text(
                    MARGIN,
                    self.y + 11.0,
                    Style::new(11.0, item.sev.color(), true),
                    &label,
                );
                self.skip(18.0);
                current = Some(item.sev);
            }
            self.card(&card_for(item, total));
        }
        self.skip(6.0);
    }
}
