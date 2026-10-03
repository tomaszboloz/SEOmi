use super::*;

pub(crate) fn annotate_page_relations(pages: &mut [CrawledPageSummary], crawl_mode: &str) {
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

    annotate_amp_targets(pages, &crawled_statuses, &canonical_targets);
    annotate_hreflang_relations(
        pages,
        &crawled_statuses,
        &hreflang_targets,
        &canonical_targets,
    );
}
