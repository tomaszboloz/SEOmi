use scraper::{Html, Selector};
use url::Url;

use super::super::{
    fetch_types::FetchedPageData,
    models::{
        CrawlConfig, CrawledCanonicalTarget, CrawledClientRedirect, CrawledIndexabilityVerdict,
        CrawledPageIssue, CrawledRobotsDecision,
    },
};
use super::page_metadata_canonical::extract_page_canonical;
use super::page_metadata_directives::extract_page_directives;
use super::page_metadata_verdicts::evaluate_page_verdicts;
use super::page_status_issues::check_page_status_issues;

pub struct PageMetadataOutcome {
    pub canonical: Option<String>,
    pub canonical_targets: Vec<CrawledCanonicalTarget>,
    pub canonical_declaration_count: usize,
    pub canonical_relation: String,
    pub canonical_robots_conflict: bool,
    pub pagination_canonical_alignment: Option<String>,
    pub client_redirects: Vec<CrawledClientRedirect>,
    pub meta_robots: Option<String>,
    pub x_robots_tag: Option<String>,
    pub robots_decision: Option<CrawledRobotsDecision>,
    pub indexability_verdict: Option<CrawledIndexabilityVerdict>,
    pub indexability_status: String,
}

pub fn extract_page_metadata(
    page_data: &FetchedPageData,
    document: &Html,
    final_base: &Url,
    final_url: &str,
    current_url: &str,
    redirect_chain_len: usize,
    redirect_stopped_reason: Option<&String>,
    pagination_declaration_count: usize,
    pagination_invalid_declaration_count: usize,
    config: &CrawlConfig,
    canonical_selector: &Selector,
    robots_selector: &Selector,
    meta_refresh_selector: &Selector,
    issues: &mut Vec<CrawledPageIssue>,
) -> PageMetadataOutcome {
    check_page_status_issues(
        page_data,
        final_url,
        current_url,
        redirect_chain_len,
        redirect_stopped_reason,
        config,
        issues,
    );

    let is_html =
        page_data.declared_html && !page_data.body_truncated && !page_data.body_read_failed;
    let canon = extract_page_canonical(
        document,
        final_base,
        final_url,
        is_html,
        pagination_declaration_count,
        pagination_invalid_declaration_count,
        canonical_selector,
        issues,
    );

    let directives = extract_page_directives(
        document,
        final_base,
        page_data,
        robots_selector,
        meta_refresh_selector,
        issues,
    );

    let canonical_robots_conflict =
        canon.canonical.is_some() && (directives.meta_noindex || directives.header_noindex);
    if is_html && canonical_robots_conflict {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: "Canonical and noindex are both present; review the intended indexing signal"
                .into(),
        });
    }

    let verdicts = evaluate_page_verdicts(
        page_data.status,
        config,
        directives.meta_robots.as_deref(),
        page_data.x_robots_tag.as_deref(),
        directives.meta_noindex,
        directives.header_noindex,
        directives.meta_nofollow,
        directives.header_nofollow,
        canon.canonical_points_elsewhere,
    );

    PageMetadataOutcome {
        canonical: canon.canonical,
        canonical_targets: canon.canonical_targets,
        canonical_declaration_count: canon.canonical_declaration_count,
        canonical_relation: canon.canonical_relation,
        canonical_robots_conflict,
        pagination_canonical_alignment: canon.pagination_canonical_alignment,
        client_redirects: directives.client_redirects,
        meta_robots: directives.meta_robots,
        x_robots_tag: page_data.x_robots_tag.clone(),
        robots_decision: verdicts.robots_decision,
        indexability_verdict: verdicts.indexability_verdict,
        indexability_status: verdicts.indexability_status,
    }
}
