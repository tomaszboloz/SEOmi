use super::labels::default_keys;
use std::collections::HashSet;

/// Every `crawl.*` key named by a string literal in the crawl report sources exists in `en.json`.
#[test]
fn every_crawl_report_label_key_exists_in_english() {
    let known: HashSet<&str> = default_keys().into_iter().collect();
    let sources = [
        include_str!("crawl_report/strings/report.rs"),
        include_str!("crawl_report/strings/labels.rs"),
        include_str!("crawl_report/strings/labels_cols.rs"),
        include_str!("crawl_report/strings/focus.rs"),
        include_str!("crawl_report/strings/recs.rs"),
        include_str!("crawl_report/strings/trust.rs"),
    ];
    let mut checked = 0;
    for source in sources {
        for literal in source.split('"').skip(1).step_by(2) {
            if literal.starts_with("crawl.")
                && !literal.contains(' ')
                && literal.matches('.').count() == 2
            {
                checked += 1;
                assert!(
                    known.contains(literal)
                        || known
                            .iter()
                            .any(|key| key.starts_with(&format!("{literal}."))),
                    "missing label key: {literal}"
                );
            }
        }
    }
    assert!(checked > 100, "only {checked} keys scanned");
}
