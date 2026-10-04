use scraper::Html;
use url::Url;

use super::super::{
    canonical::{classify_canonical_relation, crawl_canonical_declarations},
    models::{CrawledCanonicalTarget, CrawledPageIssue},
    pagination::pagination_canonical_alignment,
};

pub struct PageCanonicalOutcome {
    pub canonical: Option<String>,
    pub canonical_targets: Vec<CrawledCanonicalTarget>,
    pub canonical_declaration_count: usize,
    pub canonical_relation: String,
    pub canonical_points_elsewhere: bool,
    pub pagination_canonical_alignment: Option<String>,
}

#[cfg(test)]
#[path = "page_metadata_canonical_tests.rs"]
mod tests;

pub fn extract_page_canonical(
    document: &Html,
    final_base: &Url,
    final_url: &str,
    is_html: bool,
    pagination_declaration_count: usize,
    pagination_invalid_declaration_count: usize,
    issues: &mut Vec<CrawledPageIssue>,
) -> PageCanonicalOutcome {
    let empty_document = (!is_html).then(|| Html::parse_document(""));
    let document = empty_document.as_ref().unwrap_or(document);
    let (canonical_declaration_count, canonical_urls) =
        crawl_canonical_declarations(document, final_base);
    let canonical = canonical_urls.first().cloned();
    if is_html && canonical_declaration_count == 0 {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Missing canonical link".into(),
        });
    }
    if is_html && canonical_declaration_count > 1 {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("Multiple canonical links found ({canonical_declaration_count})"),
        });
    }

    if is_html && canonical_declaration_count == 1 && canonical.is_none() {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: "Canonical declaration has a missing, invalid, or non-HTTP URL".into(),
        });
    }

    let canonical_points_elsewhere = canonical.as_deref().is_some_and(|target| {
        classify_canonical_relation(final_url, 1, &[target.to_string()]) != "self"
    });
    let canonical_relation =
        classify_canonical_relation(final_url, canonical_declaration_count, &canonical_urls)
            .to_string();
    let pagination_canonical_alignment = (pagination_declaration_count > 0)
        .then(|| pagination_canonical_alignment(&canonical_relation))
        .flatten();
    if is_html && pagination_invalid_declaration_count > 0 {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("{pagination_invalid_declaration_count} pagination declaration(s) have a missing or invalid HTTP(S) target"),
        });
    }
    let canonical_targets = canonical_urls
        .iter()
        .map(|target| CrawledCanonicalTarget {
            url: target.clone(),
            relation: classify_canonical_relation(final_url, 1, std::slice::from_ref(target))
                .to_string(),
            http_status: None,
            checked_in_run: false,
        })
        .collect::<Vec<_>>();

    if is_html && canonical_points_elsewhere {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message:
                "Canonical points to a different URL; the target was not validated in this verdict"
                    .into(),
        });
    }

    PageCanonicalOutcome {
        canonical,
        canonical_targets,
        canonical_declaration_count,
        canonical_relation,
        canonical_points_elsewhere,
        pagination_canonical_alignment,
    }
}
