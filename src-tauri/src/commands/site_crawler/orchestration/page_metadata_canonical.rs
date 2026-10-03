use scraper::{Html, Selector};
use url::Url;

use super::super::{
    canonical::classify_canonical_relation,
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

#[allow(clippy::too_many_arguments)]
pub fn extract_page_canonical(
    document: &Html,
    final_base: &Url,
    final_url: &str,
    is_html: bool,
    pagination_declaration_count: usize,
    pagination_invalid_declaration_count: usize,
    canonical_selector: &Selector,
    issues: &mut Vec<CrawledPageIssue>,
) -> PageCanonicalOutcome {
    let canonical_urls = if is_html {
        document
            .select(canonical_selector)
            .filter_map(|element| {
                let rel = element.value().attr("rel")?;
                if !rel
                    .split_ascii_whitespace()
                    .any(|v| v.eq_ignore_ascii_case("canonical"))
                {
                    return None;
                }
                let href = element.value().attr("href")?.trim();
                (!href.is_empty())
                    .then(|| final_base.join(href).ok().map(|u| u.to_string()))
                    .flatten()
            })
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    let canonical = canonical_urls.first().cloned();
    let canonical_declaration_count = canonical_urls.len();
    if is_html && canonical_declaration_count == 0 {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Missing <link rel=\"canonical\"> declaration".into(),
        });
    }
    if is_html && canonical_declaration_count > 1 {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("Multiple canonical tags found ({canonical_declaration_count})"),
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
