use super::metrics::Metrics;
use super::strings::{report as s, t};
use crate::commands::pdf_report::audit_report::ctx::format_number;
use crate::commands::pdf_report::layout::color::{Rgb, CRITICAL, MUTED, OK, TEXT, WARNING};
use crate::commands::pdf_report::layout::text::EMPTY;
use crate::commands::pdf_report::layout::widgets::Kpi;

fn share(count: usize, total: usize) -> String {
    let percent = if total == 0 {
        0.0
    } else {
        count as f64 * 100.0 / total as f64
    };
    t(s::KPI_SHARE, &[&format!("{percent:.0}")])
}

/// Green when the count is zero, otherwise the given warning colour.
fn zero_good(count: usize, bad: Rgb) -> Rgb {
    if count == 0 {
        OK
    } else {
        bad
    }
}

pub fn kpis(m: &Metrics, total: usize) -> Vec<Kpi> {
    let card = |label, count: usize, color| Kpi {
        label,
        value: count.to_string(),
        note: share(count, total),
        color,
    };
    let plain = |label, value: String, note: &str, color| Kpi {
        label,
        value,
        note: note.into(),
        color,
    };
    let avg = |value: Option<f64>, unit: &str| match value {
        Some(v) => (t(unit, &[&format_number(v.round())]), TEXT),
        None => (EMPTY.to_owned(), MUTED),
    };
    let (time, time_color) = avg(m.avg_ms, s::MS);
    let (words, words_color) = avg(m.avg_words, "{0}");
    vec![
        card(s::K_INDEXABLE, m.counts[0], OK),
        card(s::K_BLOCKED, m.counts[1], zero_good(m.counts[1], CRITICAL)),
        card(s::K_UNCERTAIN, m.counts[2], zero_good(m.counts[2], WARNING)),
        card(s::K_2XX, m.classes[0], OK),
        card(s::K_3XX, m.classes[1], zero_good(m.classes[1], WARNING)),
        card(s::K_4XX, m.classes[2], zero_good(m.classes[2], CRITICAL)),
        card(s::K_5XX, m.classes[3], zero_good(m.classes[3], CRITICAL)),
        card(
            s::K_NO_STATUS,
            m.classes[4],
            zero_good(m.classes[4], CRITICAL),
        ),
        plain(s::K_AVG_TIME, time, s::K_AVG_NOTE, time_color),
        plain(s::K_AVG_WORDS, words, s::K_WORDS_NOTE, words_color),
        card(s::K_ORPHANS, m.orphans, zero_good(m.orphans, WARNING)),
        plain(
            s::K_DUPLICATES,
            m.dup_groups.to_string(),
            s::K_DUP_NOTE,
            zero_good(m.dup_groups, WARNING),
        ),
        plain(
            s::K_CHAINS,
            m.chains.to_string(),
            s::K_CHAIN_NOTE,
            zero_good(m.chains, WARNING),
        ),
        plain(
            s::K_BROKEN_INT,
            m.broken[0].to_string(),
            s::K_LINK_NOTE,
            zero_good(m.broken[0], CRITICAL),
        ),
        plain(
            s::K_BROKEN_EXT,
            m.broken[1].to_string(),
            s::K_LINK_NOTE,
            zero_good(m.broken[1], WARNING),
        ),
        card(
            s::K_NO_TITLE,
            m.missing[0],
            zero_good(m.missing[0], CRITICAL),
        ),
        card(s::K_NO_DESC, m.missing[1], zero_good(m.missing[1], WARNING)),
        card(s::K_NO_H1, m.missing[2], zero_good(m.missing[2], WARNING)),
        card(
            s::K_NO_CANONICAL,
            m.missing[3],
            zero_good(m.missing[3], WARNING),
        ),
        card(
            s::K_WITH_ISSUES,
            m.with_issues,
            zero_good(m.with_issues, WARNING),
        ),
    ]
}
