use scraper::{Html, Selector};

use super::super::{
    fingerprints::duplicate_heading_groups,
    models::{CrawledDuplicateHeading, CrawledPageIssue},
};

pub struct PageHeadingsOutcome {
    pub h1_count: usize,
    pub heading_counts: Vec<usize>,
    pub duplicate_headings: Vec<CrawledDuplicateHeading>,
}

pub fn extract_page_headings(
    document: &Html,
    is_html: bool,
    h1_selector: &Selector,
    headings_selector: &Selector,
    issues: &mut Vec<CrawledPageIssue>,
) -> PageHeadingsOutcome {
    let h1_count = document.select(h1_selector).count();
    let heading_levels = document
        .select(headings_selector)
        .filter_map(|el| el.value().name().strip_prefix('h'))
        .filter_map(|v| v.parse::<usize>().ok())
        .collect::<Vec<_>>();
    let mut heading_counts = vec![0usize; 6];
    for level in heading_levels {
        if (1..=6).contains(&level) {
            heading_counts[level - 1] += 1;
        }
    }
    let duplicate_headings = if is_html {
        duplicate_heading_groups(document, headings_selector)
    } else {
        Vec::new()
    };
    for duplicate in &duplicate_headings {
        let levels = duplicate
            .levels
            .iter()
            .map(|l| format!("H{l}"))
            .collect::<Vec<_>>()
            .join("/");
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: format!(
                "Repeated heading text {:?} across {levels} ({} occurrences)",
                duplicate.text, duplicate.occurrences
            ),
        });
    }
    if is_html && h1_count == 0 {
        issues.push(CrawledPageIssue {
            severity: "Critical".into(),
            message: "Missing <h1> tag".into(),
        });
    }
    if is_html && h1_count > 1 {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("Multiple <h1> tags found ({h1_count})"),
        });
    }

    PageHeadingsOutcome {
        h1_count,
        heading_counts,
        duplicate_headings,
    }
}
