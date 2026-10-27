use super::color::{Rgb, BRAND, CRITICAL, MUTED, OK, PANEL, RULE, WARNING};
use super::doc::{Doc, CONTENT_W, MARGIN};
use super::text::{Style, EMPTY};

const GAP: f32 = 8.0;
const KEEP_WITH_NEXT: f32 = 110.0;
const HEIGHT: f32 = 50.0;

/// Small metric card: caption, big value and a one-line note.
pub struct Kpi {
    pub label: &'static str,
    pub value: String,
    pub note: String,
    pub color: Rgb,
}

/// Green from 80, amber from 50, red below, grey when there is no score.
pub fn score_color(score: Option<f64>) -> Rgb {
    match score {
        Some(value) if value >= 80.0 => OK,
        Some(value) if value >= 50.0 => WARNING,
        Some(_) => CRITICAL,
        None => MUTED,
    }
}

impl Doc {
    /// Section heading with a thin brand rule; kept together with what follows.
    pub fn heading(&mut self, text: &str) {
        self.ensure(KEEP_WITH_NEXT);
        self.skip(6.0);
        self.text(MARGIN, self.y + 13.0, Style::new(14.0, BRAND, true), text);
        self.hline(MARGIN, MARGIN + CONTENT_W, self.y + 20.0, RULE, 0.8);
        self.skip(30.0);
    }

    pub fn kpi_grid(&mut self, items: &[Kpi]) {
        let width = (CONTENT_W - 3.0 * GAP) / 4.0;
        for row in items.chunks(4) {
            self.ensure(HEIGHT + GAP);
            for (index, item) in row.iter().enumerate() {
                let x = MARGIN + index as f32 * (width + GAP);
                self.rect(x, self.y, width, HEIGHT, PANEL);
                self.frame(x, self.y, width, HEIGHT, RULE);
                self.text(x + 8.0, self.y + 13.0, Style::CAPTION, item.label);
                self.text(
                    x + 8.0,
                    self.y + 31.0,
                    Style::new(15.0, item.color, true),
                    &item.value,
                );
                let note = self.fit_line(&item.note, width - 14.0, Style::CAPTION);
                self.text(x + 8.0, self.y + 44.0, Style::CAPTION, &note);
            }
            self.skip(HEIGHT + GAP);
        }
    }

    /// Big score number, rating and a coloured bar.
    pub fn score_panel(&mut self, score: Option<f64>, rating: &str, title: &str, legend: &str) {
        self.score_panel_colored(score_color(score), score, rating, title, legend);
    }

    /// Score panel drawn in a caller-chosen colour, e.g. a score band.
    pub fn score_panel_colored(
        &mut self,
        color: Rgb,
        score: Option<f64>,
        rating: &str,
        title: &str,
        legend: &str,
    ) {
        let top = self.y;
        self.rect(MARGIN, top, CONTENT_W, 74.0, PANEL);
        self.rect(MARGIN, top, 4.0, 74.0, color);
        let shown = score
            .map(|v| format!("{v:.0}"))
            .unwrap_or_else(|| EMPTY.into());
        let big = Style::new(40.0, color, score.is_some());
        self.text(MARGIN + 18.0, top + 46.0, big, &shown);
        let after = MARGIN + 22.0 + self.text_width(&shown, big);
        self.text(after, top + 46.0, Style::new(11.0, MUTED, false), "/ 100");
        self.text(
            MARGIN + 18.0,
            top + 63.0,
            Style::BODY.colored(color).bold(),
            rating,
        );
        let bar_x = MARGIN + 190.0;
        let bar_w = CONTENT_W - 190.0 - 20.0;
        self.text(bar_x, top + 20.0, Style::HEADING, title);
        self.rect(bar_x, top + 30.0, bar_w, 9.0, RULE);
        let filled = bar_w * (score.unwrap_or(0.0).clamp(0.0, 100.0) as f32) / 100.0;
        self.rect(bar_x, top + 30.0, filled, 9.0, color);
        self.text(bar_x, top + 56.0, Style::CAPTION, legend);
        self.y = top + 74.0 + 10.0;
    }

    /// Row of coloured count cards such as Critical / Warning / Info.
    pub fn count_cards(&mut self, items: &[(Rgb, &str, usize)], unit: &str) {
        let width = (CONTENT_W - (items.len() as f32 - 1.0) * GAP) / items.len() as f32;
        for (index, (color, label, count)) in items.iter().enumerate() {
            let x = MARGIN + index as f32 * (width + GAP);
            self.rect(x, self.y, width, 38.0, color.tint(0.9));
            self.rect(x, self.y, 4.0, 38.0, *color);
            let big = Style::new(20.0, *color, true);
            self.text(x + 14.0, self.y + 27.0, big, &count.to_string());
            self.text(
                x + 52.0,
                self.y + 16.0,
                Style::BODY.colored(*color).bold(),
                label,
            );
            self.text(x + 52.0, self.y + 28.0, Style::CAPTION, unit);
        }
        self.skip(38.0 + 14.0);
    }

    /// Caption/value pairs in a row, e.g. start time, duration.
    pub fn facts_row(&mut self, facts: &[(&str, String)]) {
        let step = CONTENT_W / facts.len() as f32;
        for (index, (label, value)) in facts.iter().enumerate() {
            let x = MARGIN + index as f32 * step;
            let shown = self.fit_line(value, step - 8.0, Style::BODY.bold());
            self.text(x, self.y + 8.0, Style::CAPTION, label);
            self.text(x, self.y + 20.0, Style::BODY.bold(), &shown);
        }
        self.skip(36.0);
    }
}
