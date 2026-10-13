use super::ctx::{format_number, Ctx};
use super::strings::{report as s, t};
use crate::commands::pdf_report::layout::color::{
    Rgb, CRITICAL, MUTED, OK, PANEL, RULE, TEXT, WARNING,
};
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::{Style, EMPTY};

const GAP: f32 = 8.0;
const HEIGHT: f32 = 50.0;
const SLOW_MS: f64 = 800.0;

pub struct Kpi {
    pub label: &'static str,
    pub value: String,
    pub note: String,
    pub color: Rgb,
}

fn kpi(label: &'static str, value: Option<String>, note: String, color: Rgb) -> Kpi {
    let note = if value.is_some() { note } else { String::new() };
    let color = if value.is_some() { color } else { MUTED };
    Kpi {
        label,
        value: value.unwrap_or_else(|| EMPTY.into()),
        note,
        color,
    }
}

fn http_color(status: Option<f64>) -> Rgb {
    match status {
        Some(code) if code < 300.0 => OK,
        Some(code) if code < 400.0 => WARNING,
        Some(_) => CRITICAL,
        None => MUTED,
    }
}

pub fn kpis(ctx: &Ctx) -> Vec<Kpi> {
    let images = ctx.list("/images");
    let without_alt = images
        .iter()
        .filter(|i| i.get("has_alt") != Some(&true.into()))
        .count();
    let time = ctx.number("/response_time_ms");
    let slow =
        time.is_some_and(|ms| ms > SLOW_MS) || ctx.issue(&["performance_response"]).is_some();
    let title = ctx.count("/meta_tags/title_length");
    let description = ctx.text("/meta_tags/description");
    let h1 = ctx.number("/headings/h1_count");
    let note = |has: bool, ok: &str, bad: &str| if has { ok } else { bad }.to_owned();
    vec![
        kpi(
            s::KPI_HTTP,
            ctx.count("/http_status"),
            s::HTTP_NOTE.into(),
            http_color(ctx.number("/http_status")),
        ),
        kpi(
            s::KPI_TIME,
            time.map(|v| t(s::MS, &[&format_number(v)])),
            note(slow, s::SLOW, s::FAST),
            if slow { WARNING } else { OK },
        ),
        kpi(
            s::KPI_TITLE,
            title,
            s::CHARACTERS.into(),
            if ctx.issue(&["meta_title"]).is_some() {
                WARNING
            } else {
                OK
            },
        ),
        kpi(
            s::KPI_DESCRIPTION,
            ctx.audit
                .get("meta_tags")
                .map(|_| note(description.is_some(), s::PRESENT, s::MISSING)),
            description
                .as_ref()
                .and(ctx.count("/meta_tags/description_length"))
                .map(|n| t(s::CHARS_NOTE, &[&n]))
                .unwrap_or_default(),
            if description.is_some() { OK } else { CRITICAL },
        ),
        kpi(
            s::KPI_H1,
            h1.map(format_number),
            s::H1_NOTE.into(),
            if h1 == Some(1.0) { OK } else { WARNING },
        ),
        kpi(
            s::KPI_IMAGES,
            ctx.audit.get("images").map(|_| images.len().to_string()),
            t(s::NO_ALT_NOTE, &[&without_alt.to_string()]),
            if without_alt == 0 { OK } else { WARNING },
        ),
        kpi(
            s::KPI_LINKS,
            ctx.count("/links/total_links"),
            t(
                s::LINKS_NOTE,
                &[
                    &ctx.count("/links/internal_links").unwrap_or_default(),
                    &ctx.count("/links/external_links").unwrap_or_default(),
                ],
            ),
            TEXT,
        ),
        kpi(
            s::KPI_WORDS,
            ctx.count("/content_stats/word_count"),
            s::WORDS_NOTE.into(),
            TEXT,
        ),
    ]
}

impl Doc {
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
}
