use super::data::{list, Crawl};
use super::kpis::kpis;
use super::metrics::compute;
use super::strings::{report as s, t};
use crate::commands::pdf_report::audit_report::ctx::{field, format_number, pretty_time};
use crate::commands::pdf_report::layout::color::{BRAND, CRITICAL, INFO, TEXT, WARNING};
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::{dash, Style, EMPTY};

pub fn duration(ms: Option<f64>) -> String {
    match ms {
        None => EMPTY.into(),
        Some(ms) if ms < 60_000.0 => t(s::SECONDS, &[&format!("{:.1}", ms / 1000.0)]),
        Some(ms) => {
            let total = (ms / 1000.0).round() as u64;
            t(
                s::MIN_SEC,
                &[&(total / 60).to_string(), &(total % 60).to_string()],
            )
        }
    }
}

fn rating(score: Option<f64>) -> &'static str {
    match score {
        Some(v) if v >= 80.0 => s::RATING_GOOD,
        Some(v) if v >= 50.0 => s::RATING_FAIR,
        Some(_) => s::RATING_POOR,
        None => s::RATING_NONE,
    }
}

/// Severity totals from the result, or counted from the pages when absent.
fn severity_counts(c: &Crawl) -> [usize; 3] {
    let counted = |label: &str| {
        c.pages
            .iter()
            .flat_map(|p| list(p, "issues"))
            .filter(|i| field(i, "severity").is_some_and(|v| v.eq_ignore_ascii_case(label)))
            .count()
    };
    let pick = |key: &str, label: &str| c.rnum(key).map_or_else(|| counted(label), |v| v as usize);
    [
        pick("critical_count", "critical"),
        pick("warning_count", "warning"),
        pick("notice_count", "info"),
    ]
}

fn banner(c: &Crawl) -> Option<String> {
    let mut notes = Vec::new();
    if c.rflag("cancelled") {
        notes.push(s::NOTE_CANCELLED.to_owned());
    }
    if c.rflag("timed_out") {
        notes.push(s::NOTE_TIMED_OUT.to_owned());
    }
    let reasons: Vec<String> = c
        .rlist("limit_reasons")
        .iter()
        .filter_map(|r| r.as_str().map(str::to_owned))
        .collect();
    if !reasons.is_empty() {
        notes.push(t(s::NOTE_LIMITS, &[&reasons.join(", ")]));
    }
    if let Some(warning) = c.r("robots_txt_warning") {
        notes.push(t(s::NOTE_ROBOTS, &[&warning]));
    }
    (!notes.is_empty()).then(|| notes.join(" "))
}

impl Doc {
    pub fn crawl_cover(&mut self, c: &Crawl) {
        self.text(MARGIN, self.y + 18.0, Style::TITLE.colored(BRAND), s::TITLE);
        self.skip(28.0);
        let scope = field(c.run, "scope_start_url").unwrap_or_default();
        self.paragraph(MARGIN, CONTENT_W, Style::new(11.0, TEXT, true), &scope);
        self.skip(4.0);
        let completed = field(c.run, "completed_at").map(|raw| pretty_time(&raw));
        let pages = c.rnum("pages_crawled").map(format_number);
        self.facts_row(&[
            (s::COMPLETED_AT, dash(completed.as_deref().unwrap_or(""))),
            (s::DURATION, duration(c.rnum("duration_ms"))),
            (s::PAGES_CRAWLED, dash(pages.as_deref().unwrap_or(""))),
        ]);
        let mode = c.r("crawl_mode").unwrap_or_else(|| s::MODE_DEFAULT.into());
        let version = c
            .r("score_version")
            .unwrap_or_else(|| s::VERSION_NONE.into());
        let env = field(c.run, "environment").unwrap_or_else(|| s::ENV_DEFAULT.into());
        self.facts_row(&[
            (s::MODE, mode),
            (s::ENVIRONMENT, env),
            (s::SCORE_VERSION, version),
        ]);
        if let Some(note) = banner(c) {
            self.paragraph(
                MARGIN,
                CONTENT_W,
                Style::BODY.colored(WARNING).bold(),
                &note,
            );
            self.skip(8.0);
        }
        let score = c.rnum("health_score");
        self.score_panel(score, rating(score), s::HEALTH_SCORE, s::LEGEND);
        let [critical, warning, notice] = severity_counts(c);
        self.count_cards(
            &[
                (CRITICAL, s::CRITICAL, critical),
                (WARNING, s::WARNING, warning),
                (INFO, s::NOTICE, notice),
            ],
            s::FINDINGS,
        );
        self.kpi_grid(&kpis(&compute(c.pages), c.pages.len()));
    }
}
