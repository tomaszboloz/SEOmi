use super::*;

pub(super) struct CrawlScore {
    pub(super) critical_count: usize,
    pub(super) warning_count: usize,
    pub(super) notice_count: usize,
    pub(super) health_score: u8,
}

pub(super) fn score_pages(pages: &[CrawledPageSummary]) -> CrawlScore {
    let critical_count = pages
        .iter()
        .flat_map(|p| &p.issues)
        .filter(|i| i.severity == "Critical")
        .count();

    let warning_count = pages
        .iter()
        .flat_map(|p| &p.issues)
        .filter(|i| i.severity == "Warning")
        .count();

    let notice_count = pages
        .iter()
        .flat_map(|p| &p.issues)
        .filter(|i| i.severity == "Info")
        .count();

    let penalty = (critical_count * 15 + warning_count * 5).min(80);
    let health_score = 100u8.saturating_sub(penalty as u8).max(20);

    CrawlScore {
        critical_count,
        warning_count,
        notice_count,
        health_score,
    }
}
