use super::*;

pub(super) fn annotate_amp_targets(
    pages: &mut [CrawledPageSummary],
    crawled_statuses: &std::collections::HashMap<String, u16>,
    canonical_targets: &std::collections::HashMap<String, Option<String>>,
) {
    for page in pages.iter_mut() {
        let Some(amp_url) = page.amp_url.clone() else {
            continue;
        };
        let (status, canonical_alignment) = verify_amp_target(
            &page.url,
            &page.final_url,
            &amp_url,
            crawled_statuses,
            canonical_targets,
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
                if page.amp_target_canonical_alignment.as_deref()
                    == Some("canonical-points-elsewhere")
                {
                    page.issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message:
                            "AMP target canonical points to a URL other than its source page or itself"
                                .into(),
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
                message:
                    "AMP target was not included in this crawl; its response and canonical were not verified"
                        .into(),
            }),
        }
        page.issues_count = page.issues.len();
    }
}

pub(super) fn annotate_hreflang_relations(
    pages: &mut [CrawledPageSummary],
    crawled_statuses: &std::collections::HashMap<String, u16>,
    hreflang_targets: &std::collections::HashMap<String, HashSet<String>>,
    canonical_targets: &std::collections::HashMap<String, Option<String>>,
) {
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
                crawled_statuses,
                hreflang_targets,
                canonical_targets,
            ));
        }
        page.issues_count = page.issues.len();
    }
}
