use super::ctx::{format_number, Ctx};
use super::strings::{report as s, t, tf};
use crate::commands::pdf_report::layout::color::{Rgb, CRITICAL, MUTED, OK, TEXT, WARNING};
use crate::commands::pdf_report::layout::text::EMPTY;
use crate::commands::pdf_report::layout::widgets::Kpi;

const SLOW_MS: f64 = 800.0;

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
            t(s::KPI_HTTP),
            ctx.count("/http_status"),
            t(s::HTTP_NOTE).into(),
            http_color(ctx.number("/http_status")),
        ),
        kpi(
            t(s::KPI_TIME),
            time.map(|v| tf(t(s::MS), &[&format_number(v)])),
            note(slow, t(s::SLOW), t(s::FAST)),
            if slow { WARNING } else { OK },
        ),
        kpi(
            t(s::KPI_TITLE),
            title,
            t(s::CHARACTERS).into(),
            if ctx.issue(&["meta_title"]).is_some() {
                WARNING
            } else {
                OK
            },
        ),
        kpi(
            t(s::KPI_DESCRIPTION),
            ctx.audit
                .get("meta_tags")
                .map(|_| note(description.is_some(), t(s::PRESENT), t(s::MISSING))),
            description
                .as_ref()
                .and(ctx.count("/meta_tags/description_length"))
                .map(|n| tf(t(s::CHARS_NOTE), &[&n]))
                .unwrap_or_default(),
            if description.is_some() { OK } else { CRITICAL },
        ),
        kpi(
            t(s::KPI_H1),
            h1.map(format_number),
            t(s::H1_NOTE).into(),
            if h1 == Some(1.0) { OK } else { WARNING },
        ),
        kpi(
            t(s::KPI_IMAGES),
            ctx.audit.get("images").map(|_| images.len().to_string()),
            tf(t(s::NO_ALT_NOTE), &[&without_alt.to_string()]),
            if without_alt == 0 { OK } else { WARNING },
        ),
        kpi(
            t(s::KPI_LINKS),
            ctx.count("/links/total_links"),
            tf(
                t(s::LINKS_NOTE),
                &[
                    &ctx.count("/links/internal_links").unwrap_or_default(),
                    &ctx.count("/links/external_links").unwrap_or_default(),
                ],
            ),
            TEXT,
        ),
        kpi(
            t(s::KPI_WORDS),
            ctx.count("/content_stats/word_count"),
            t(s::WORDS_NOTE).into(),
            TEXT,
        ),
    ]
}
