use super::*;

pub(super) fn annotate_duplicates(pages: &mut [CrawledPageSummary]) {
    let duplicate_titles = duplicate_text_indices(pages.iter().map(|page| page.title.as_deref()));
    for indices in duplicate_titles {
        for index in indices {
            let page = &mut pages[index];
            page.issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: "Duplicate title found in this crawl".into(),
            });
            page.issues_count = page.issues.len();
        }
    }
    let duplicate_descriptions =
        duplicate_text_indices(pages.iter().map(|page| page.meta_description.as_deref()));
    for indices in duplicate_descriptions {
        for index in indices {
            let page = &mut pages[index];
            page.issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: "Duplicate meta description found in this crawl".into(),
            });
            page.issues_count = page.issues.len();
        }
    }

    let mut fingerprints: std::collections::HashMap<String, Vec<usize>> =
        std::collections::HashMap::new();
    for (index, page) in pages.iter().enumerate() {
        if let Some(hash) = page.content_hash.as_deref() {
            fingerprints.entry(hash.to_owned()).or_default().push(index);
        }
    }
    for indices in fingerprints
        .into_values()
        .filter(|indices| indices.len() > 1)
    {
        for index in indices {
            let page = &mut pages[index];
            page.issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: "Duplicate normalized page content found in this crawl".into(),
            });
            page.issues_count = page.issues.len();
        }
    }

    let near_duplicate_signatures = pages
        .iter()
        .enumerate()
        .filter(|(_, page)| page.word_count >= 20)
        .filter_map(|(index, page)| {
            page.content_simhash
                .clone()
                .map(|signature| (index, signature))
        })
        .collect::<Vec<_>>();
    for (left, right, distance) in near_duplicate_pairs(&near_duplicate_signatures) {
        if pages[left].content_hash == pages[right].content_hash {
            continue;
        }
        let left_url = pages[left].final_url.clone();
        let right_url = pages[right].final_url.clone();
        pages[left].issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("Near-duplicate content with {right_url} (local SimHash distance {distance}/64; threshold ≤7)"),
        });
        pages[right].issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("Near-duplicate content with {left_url} (local SimHash distance {distance}/64; threshold ≤7)"),
        });
        pages[left].issues_count = pages[left].issues.len();
        pages[right].issues_count = pages[right].issues.len();
    }
}
