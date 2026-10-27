use super::ctx::{pretty_time, Ctx};
use super::kpi::kpis;
use super::model::Sev;
use super::strings::{report as s, t, tf};
use crate::commands::pdf_report::layout::color::BRAND;
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::{dash, Style};

fn rating(score: Option<f64>) -> &'static str {
    match score {
        Some(value) if value >= 80.0 => t(s::RATING_GOOD),
        Some(value) if value >= 50.0 => t(s::RATING_FAIR),
        Some(_) => t(s::RATING_POOR),
        None => t(s::RATING_NONE),
    }
}

impl Doc {
    fn title_block(&mut self, ctx: &Ctx) {
        self.text(
            MARGIN,
            self.y + 18.0,
            Style::TITLE.colored(BRAND),
            t(s::TITLE),
        );
        self.skip(28.0);
        let url = Style::new(11.0, super::super::layout::color::TEXT, true);
        self.paragraph(
            MARGIN,
            CONTENT_W,
            url,
            &ctx.text("/final_url").unwrap_or_default(),
        );
        self.skip(4.0);
        let facts = [
            (
                t(s::AUDITED_AT),
                ctx.text("/timestamp").map(|raw| pretty_time(&raw)),
            ),
            (t(s::HTTP_STATUS), ctx.count("/http_status")),
            (
                t(s::RESPONSE_TIME),
                ctx.count("/response_time_ms")
                    .map(|ms| tf(t(s::MS), &[&ms])),
            ),
        ];
        for (index, (label, value)) in facts.iter().enumerate() {
            let x = MARGIN + index as f32 * CONTENT_W * 0.38;
            self.text(x, self.y + 8.0, Style::CAPTION, label);
            self.text(
                x,
                self.y + 20.0,
                Style::BODY.bold(),
                &dash(value.as_deref().unwrap_or("")),
            );
        }
        self.skip(36.0);
    }

    fn audit_score(&mut self, ctx: &Ctx) {
        let score = ctx.number("/health_score");
        self.score_panel(score, rating(score), t(s::HEALTH_SCORE), t(s::LEGEND));
    }

    fn audit_counts(&mut self, ctx: &Ctx) {
        let items: Vec<_> = [Sev::Critical, Sev::Warning, Sev::Info]
            .into_iter()
            .map(|sev| {
                let count = ctx.findings.iter().filter(|f| f.sev == sev).count();
                (sev.color(), sev.label(), count)
            })
            .collect();
        self.count_cards(&items, t(s::FINDINGS));
    }

    pub fn summary(&mut self, ctx: &Ctx) {
        self.title_block(ctx);
        self.audit_score(ctx);
        self.audit_counts(ctx);
        self.kpi_grid(&kpis(ctx));
    }
}
