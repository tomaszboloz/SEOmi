use super::*;
use chrono::{DateTime, Duration, Utc};

fn at(text: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(text)
        .unwrap()
        .with_timezone(&Utc)
}
const NOW: &str = "2026-10-10T12:00:00Z";

fn entry(fingerprint: &str, kind: &str, when: &str) -> LedgerEntry {
    LedgerEntry {
        fingerprint: fingerprint.into(),
        alert_type: kind.into(),
        occurred_at: when.into(),
    }
}

#[test]
fn duplicates_follow_fingerprint_and_frequency_window() {
    let entries = [entry("a", "crawl", "2026-10-10T00:00:00Z")];
    let now = at(NOW);
    assert!(is_duplicate(&entries, "a", "gsc", None, now));
    assert!(!is_duplicate(&entries, "b", "crawl", None, now));
    assert!(is_duplicate(
        &entries,
        "b",
        "crawl",
        Some(Duration::days(1)),
        now
    ));
    assert!(!is_duplicate(
        &entries,
        "b",
        "gsc",
        Some(Duration::days(1)),
        now
    ));
    assert!(!is_duplicate(
        &entries,
        "b",
        "crawl",
        Some(Duration::days(1)),
        at("2026-10-11T00:00:01Z")
    ));
    assert!(is_duplicate(
        &entries,
        "b",
        "crawl",
        Some(Duration::days(7)),
        at("2026-10-16T00:00:00Z")
    ));
    let broken = [entry("a", "crawl", "not a time")];
    assert!(!is_duplicate(
        &broken,
        "b",
        "crawl",
        Some(Duration::days(1)),
        now
    ));
    assert_eq!(window("run").unwrap(), None);
    assert_eq!(window("weekly").unwrap(), Some(Duration::days(7)));
    assert!(window("hourly").is_err());
}
