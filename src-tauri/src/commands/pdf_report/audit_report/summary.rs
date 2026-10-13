use super::ctx::{pretty_time, Ctx};
use super::kpi::kpis;
use super::model::Sev;
use super::strings::{report as s, t};
use crate::commands::pdf_report::layout::color::{
    Rgb, BRAND, CRITICAL, MUTED, OK, PANEL, RULE, WARNING,
};
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::{dash, Style, EMPTY};

pub fn score_color(score: Option<f64>) -> Rgb {
    match score {
        Some(value) if value >= 80.0 => OK,
        Some(value) if value >= 50.0 => WARNING,
        Some(_) => CRITICAL,
        None => MUTED,
    }
}

fn rating(score: Option<f64>) -> &'static str {
    match score {
        Some(value) if value >= 80.0 => s::RATING_GOOD,
        Some(value) if value >= 50.0 => s::RATING_FAIR,
        Some(_) => s::RATING_POOR,
        None => s::RATING_NONE,
    }
}

impl Doc {
    fn title_block(&mut self, ctx: &Ctx) {
        self.text(MARGIN, self.y + 18.0, Style::TITLE.colored(BRAND), s::TITLE);
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
                s::AUDITED_AT,
                ctx.text("/timestamp").map(|raw| pretty_time(&raw)),
            ),
            (s::HTTP_STATUS, ctx.count("/http_status")),
            (
                s::RESPONSE_TIME,
                ctx.count("/response_time_ms").map(|ms| t(s::MS, &[&ms])),
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

    fn score_panel(&mut self, ctx: &Ctx) {
        let score = ctx.number("/health_score");
        let color = score_color(score);
        let top = self.y;
        self.rect(MARGIN, top, CONTENT_W, 74.0, PANEL);
        self.rect(MARGIN, top, 4.0, 74.0, color);
        let shown = score
            .map(|v| format!("{v:.0}"))
            .unwrap_or_else(|| EMPTY.into());
        let big = Style::new(40.0, color, score.is_some());
        self.text(MARGIN + 18.0, top + 46.0, big, &shown);
        let after = MARGIN + 22.0 + self.text_width(&shown, big);
        self.text(after, top + 46.0, Style::new(11.0, MUTED, false), s::OUT_OF);
        self.text(
            MARGIN + 18.0,
            top + 63.0,
            Style::BODY.colored(color).bold(),
            rating(score),
        );
        let bar_x = MARGIN + 190.0;
        let bar_w = CONTENT_W - 190.0 - 20.0;
        self.text(bar_x, top + 20.0, Style::HEADING, s::HEALTH_SCORE);
        self.rect(bar_x, top + 30.0, bar_w, 9.0, RULE);
        let filled = bar_w * (score.unwrap_or(0.0).clamp(0.0, 100.0) as f32) / 100.0;
        self.rect(bar_x, top + 30.0, filled, 9.0, color);
        self.text(bar_x, top + 56.0, Style::CAPTION, s::LEGEND);
        self.y = top + 74.0 + 10.0;
    }

    fn severity_cards(&mut self, ctx: &Ctx) {
        let width = (CONTENT_W - 2.0 * 8.0) / 3.0;
        for (index, sev) in [Sev::Critical, Sev::Warning, Sev::Info]
            .into_iter()
            .enumerate()
        {
            let count = ctx.findings.iter().filter(|f| f.sev == sev).count();
            let x = MARGIN + index as f32 * (width + 8.0);
            let color = sev.color();
            self.rect(x, self.y, width, 38.0, color.tint(0.9));
            self.rect(x, self.y, 4.0, 38.0, color);
            self.text(
                x + 14.0,
                self.y + 27.0,
                Style::new(20.0, color, true),
                &count.to_string(),
            );
            self.text(
                x + 44.0,
                self.y + 16.0,
                Style::BODY.colored(color).bold(),
                sev.label(),
            );
            self.text(x + 44.0, self.y + 28.0, Style::CAPTION, s::FINDINGS);
        }
        self.skip(38.0 + 14.0);
    }

    pub fn summary(&mut self, ctx: &Ctx) {
        self.title_block(ctx);
        self.score_panel(ctx);
        self.severity_cards(ctx);
        self.kpi_grid(&kpis(ctx));
    }
}
