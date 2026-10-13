use super::ctx::Ctx;
use super::model::{Finding, Sev};
use super::strings::{report as s, t};
use crate::commands::pdf_report::layout::card::{Card, CardRow};
use crate::commands::pdf_report::layout::color::OK;
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::Style;

const KEEP_WITH_NEXT: f32 = 110.0;

fn card_for(finding: &Finding) -> Card {
    Card {
        accent: finding.sev.color(),
        badge: finding.sev.label().to_uppercase(),
        meta: finding.category.clone(),
        tag: finding.code.clone(),
        headline: finding.message.clone(),
        rows: vec![
            CardRow {
                label: s::WHERE.into(),
                items: finding.location.clone(),
            },
            CardRow {
                label: s::HOW_TO_FIX.into(),
                items: vec![finding.recommendation.clone()],
            },
        ],
    }
}

impl Doc {
    pub fn issues_section(&mut self, ctx: &Ctx) {
        self.heading(s::FIX_FIRST);
        if ctx.findings.is_empty() {
            self.paragraph(
                MARGIN,
                CONTENT_W,
                Style::BODY.colored(OK).bold(),
                s::NO_ISSUES,
            );
            return self.skip(10.0);
        }
        self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, s::FIX_INTRO);
        self.skip(6.0);
        let mut current: Option<(Sev, &str)> = None;
        for finding in &ctx.findings {
            if current.map(|(sev, _)| sev) != Some(finding.sev) {
                let count = ctx.findings.iter().filter(|f| f.sev == finding.sev).count();
                self.ensure(KEEP_WITH_NEXT);
                let label = t(
                    s::SEVERITY_GROUP,
                    &[finding.sev.label(), &count.to_string()],
                );
                self.text(
                    MARGIN,
                    self.y + 11.0,
                    Style::new(11.0, finding.sev.color(), true),
                    &label,
                );
                self.skip(18.0);
                current = None;
            }
            if current.map(|(_, category)| category) != Some(finding.category.as_str()) {
                self.ensure(KEEP_WITH_NEXT);
                self.text(
                    MARGIN,
                    self.y + 8.0,
                    Style::CAPTION.bold(),
                    &finding.category.to_uppercase(),
                );
                self.skip(13.0);
            }
            current = Some((finding.sev, finding.category.as_str()));
            self.card(&card_for(finding));
        }
        self.skip(6.0);
    }
}
