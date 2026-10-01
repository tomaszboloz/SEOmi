use super::*;

pub(super) fn annotate_page_relations(pages: &mut [CrawledPageSummary], crawl_mode: &str) {
    let crawled_statuses = pages
        .iter()
        .filter(|page| !(crawl_mode == "browser-rendered" && page.http_status == 0))
        .flat_map(|page| {
            [
                (page.url.clone(), page.http_status),
                (page.final_url.clone(), page.http_status),
            ]
        })
        .collect::<std::collections::HashMap<_, _>>();
    let pagination_graph = pagination_edges(pages);
    let crawled_page_identities = pages
        .iter()
        .flat_map(|page| [page.url.as_str(), page.final_url.as_str()])
        .filter_map(canonical_identity_url)
        .map(|url| url.to_string())
        .collect::<HashSet<_>>();
    for page in pages.iter_mut() {
        for target in &mut page.canonical_targets {
            if let Some(status) = verify_canonical_target(target, &crawled_statuses) {
                if status == 0 || status >= 400 {
                    page.issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!("Canonical target returned HTTP {status} in this crawl"),
                    });
                }
            }
        }
        for target in &mut page.pagination_links {
            if let Some(status) = verify_pagination_target(target, &crawled_statuses) {
                if status == 0 || status >= 400 {
                    page.issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!(
                            "Pagination {} target returned HTTP {status} in this crawl",
                            target.relation
                        ),
                    });
                }
            }
            let Some(expected_relation) = opposite_pagination_relation(&target.relation) else {
                continue;
            };
            let Some(source_identity) = canonical_identity_url(&page.final_url)
                .or_else(|| canonical_identity_url(&page.url))
                .map(|url| url.to_string())
            else {
                continue;
            };
            let Some(target_identity) =
                canonical_identity_url(&target.target_url).map(|url| url.to_string())
            else {
                continue;
            };
            if crawled_page_identities.contains(&target_identity) {
                target.reciprocal_in_run = Some(pagination_graph.contains(&(
                    target_identity,
                    expected_relation.to_string(),
                    source_identity,
                )));
                if target.reciprocal_in_run == Some(false) {
                    page.issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: format!(
                            "Pagination {} target has no reciprocal {} declaration in this crawl",
                            target.relation, expected_relation
                        ),
                    });
                }
            }
        }
        for link in &mut page.links {
            if link.is_internal {
                link.target_http_status = crawled_statuses.get(&link.target_url).copied();
            }
        }
        let broken_targets = page
            .links
            .iter()
            .filter(|link| {
                link.is_internal
                    && link
                        .target_http_status
                        .is_some_and(|status| status == 0 || status >= 400)
            })
            .map(|link| link.target_url.as_str())
            .collect::<HashSet<_>>();
        if !broken_targets.is_empty() {
            page.issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: format!(
                    "{} internal link target(s) returned an error in this crawl",
                    broken_targets.len()
                ),
            });
        }
        page.issues_count = page.issues.len();
    }
    let hreflang_targets = pages
        .iter()
        .flat_map(|page| {
            [
                (
                    page.url.clone(),
                    page.hreflangs
                        .iter()
                        .map(|item| item.target_url.clone())
                        .collect::<HashSet<_>>(),
                ),
                (
                    page.final_url.clone(),
                    page.hreflangs
                        .iter()
                        .map(|item| item.target_url.clone())
                        .collect::<HashSet<_>>(),
                ),
            ]
        })
        .collect::<std::collections::HashMap<_, _>>();
    let canonical_targets = pages
        .iter()
        .flat_map(|page| {
            [
                (page.url.clone(), page.canonical.clone()),
                (page.final_url.clone(), page.canonical.clone()),
            ]
        })
        .collect::<std::collections::HashMap<_, _>>();
    for page in pages.iter_mut() {
        let Some(amp_url) = page.amp_url.clone() else {
            continue;
        };
        let (status, canonical_alignment) = verify_amp_target(
            &page.url,
            &page.final_url,
            &amp_url,
            &crawled_statuses,
            &canonical_targets,
        );
        match status {
            Some(status) => {
                page.amp_target_http_status = Some(status);
                page.amp_target_checked_in_run = true;
                page.amp_target_canonical_alignment = canonical_alignment;
                if status >= 400 || status == 0 {
                    page.issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!("AMP target returned HTTP {status} in this crawl"),
                    });
                }
                if page.amp_target_canonical_alignment.as_deref() == Some("canonical-points-elsewhere")
                {
                    page.issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "AMP target canonical points to a URL other than its source page or itself".into(),
                    });
                }
                if page.amp_target_canonical_alignment.as_deref() == Some("missing-canonical") {
                    page.issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "AMP target in this crawl has no canonical declaration".into(),
                    });
                }
            }
            None => page.issues.push(CrawledPageIssue {
                severity: "Info".into(),
                message: "AMP target was not included in this crawl; its response and canonical were not verified"
                    .into(),
            }),
        }
        page.issues_count = page.issues.len();
    }
    for page in pages.iter_mut() {
        page.issues.extend(validate_hreflang_declarations(
            &page.url,
            &page.final_url,
            &page.hreflangs,
        ));
        for hreflang in &mut page.hreflangs {
            page.issues.extend(annotate_hreflang_target(
                &page.url,
                &page.final_url,
                hreflang,
                &crawled_statuses,
                &hreflang_targets,
                &canonical_targets,
            ));
        }
        page.issues_count = page.issues.len();
    }
}

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

    let mut descriptions: std::collections::HashMap<String, Vec<usize>> =
        std::collections::HashMap::new();
    for (index, page) in pages.iter().enumerate() {
        if let Some(description) = page
            .meta_description
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            descriptions
                .entry(description.to_ascii_lowercase())
                .or_default()
                .push(index);
        }
    }
    for indices in descriptions
        .into_values()
        .filter(|indices| indices.len() > 1)
    {
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
