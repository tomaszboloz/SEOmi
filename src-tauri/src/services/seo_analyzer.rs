use crate::models::audit_data::{Issue, PageAuditData};
use crate::services::amp_validator::audit_amp;
use crate::services::html_parser::parse_html;
use crate::services::http_client::FetchResult;
use crate::services::og_parser::parse_social_tags;
use anyhow::Result;
use chrono::Utc;
use url::Url;

mod accessibility;
mod findings_audit;
mod headings;
mod images;
mod indexability;
mod links;
mod metadata;
mod performance_audit;
mod scoring;
mod transport_audit;
mod transport_security;

use accessibility::audit_accessibility;
use findings_audit::{collect_amp_issues, collect_structured_data_issues};
use headings::parse_headings;
use images::parse_images;
use links::parse_links;
use metadata::audit_meta_tags;
use performance_audit::audit_performance_and_indexability;
use scoring::calculate_health_score;
use transport_audit::audit_transport;
use transport_security::enrich_header_technologies;

#[cfg(test)]
use crate::models::audit_data::{IssueCategory, IssueSeverity};
#[cfg(test)]
use indexability::{assess_indexability, verify_canonical_target};
#[cfg(test)]
use transport_security::{assess_cookie_headers, detect_mixed_content_resources};

/// Master SEO analyzer orchestrating all sub-audits
pub async fn analyze_page(fetch_result: FetchResult) -> Result<PageAuditData> {
    let mut all_issues: Vec<Issue> = Vec::new();
    let parsed_url = Url::parse(&fetch_result.final_url)
        .or_else(|_| Url::parse(&fetch_result.url))
        .map_err(|_| anyhow::anyhow!("Audit response has no valid absolute URL"))?;

    // 1. Parse HTML core data
    let html_data = parse_html(&fetch_result.body, fetch_result.final_url.as_str())?;
    let amp = audit_amp(&fetch_result.body, fetch_result.final_url.as_str());

    // 2. Parse Social & Open Graph tags
    let social_data = parse_social_tags(
        &fetch_result.body,
        fetch_result.final_url.as_str(),
        html_data.meta_tags.title.as_deref(),
        html_data.meta_tags.description.as_deref(),
    );

    // 3. Parse Headings Hierarchy
    let (headings, mut heading_issues) = parse_headings(&fetch_result.body);
    all_issues.append(&mut heading_issues);

    // 4. Audit Images
    let (images, mut image_issues) = parse_images(&fetch_result.body, &parsed_url);
    all_issues.append(&mut image_issues);

    // 5. Audit Links
    let (links, mut link_issues) = parse_links(&fetch_result.body, &parsed_url);
    all_issues.append(&mut link_issues);

    // 6. Audit Transport & Security Headers
    let transport_output = audit_transport(
        &fetch_result.headers,
        &fetch_result.set_cookie_headers,
        &fetch_result.body,
        &parsed_url,
    );
    let mut transport_issues = transport_output.issues;
    all_issues.append(&mut transport_issues);

    // 7. Audit Meta Tags and Accessibility
    let mut meta_issues = audit_meta_tags(&html_data.meta_tags, &parsed_url);
    all_issues.append(&mut meta_issues);
    let mut accessibility_issues = audit_accessibility(&html_data.accessibility);
    all_issues.append(&mut accessibility_issues);

    // 8. Collect Structured Data & AMP findings
    let mut sd_issues = collect_structured_data_issues(&html_data.structured_data);
    all_issues.append(&mut sd_issues);
    let mut amp_issues = collect_amp_issues(&amp);
    all_issues.append(&mut amp_issues);

    // 9. Audit HTTP Response & Indexability
    let (indexability, mut perf_issues) =
        audit_performance_and_indexability(&fetch_result, &html_data.meta_tags).await;
    all_issues.append(&mut perf_issues);

    // 10. Calculate Overall Health Score
    let health_score = calculate_health_score(&all_issues, fetch_result.status);

    // Technical data enriched with server header & content-type
    let mut tech = html_data.technical;
    tech.server = fetch_result.headers.get("server").cloned();
    tech.content_type = fetch_result.headers.get("content-type").cloned();
    enrich_header_technologies(&mut tech.technology_signals, &fetch_result.headers);

    Ok(PageAuditData {
        url: fetch_result.url,
        final_url: fetch_result.final_url,
        timestamp: Utc::now(),
        http_status: fetch_result.status,
        response_time_ms: fetch_result.response_time_ms,
        redirect_chain: fetch_result.redirect_chain,
        meta_tags: html_data.meta_tags,
        open_graph: social_data.open_graph,
        twitter_card: social_data.twitter_card,
        headings,
        images,
        links,
        security_headers: transport_output.sec_result.headers,
        structured_data: html_data.structured_data,
        technical: tech,
        health_score,
        issues: all_issues,
        content_stats: html_data.content_stats,
        indexability,
        accessibility: html_data.accessibility,
        amp,
        http_performance: Some(fetch_result.http_performance),
        transport_security: Some(transport_output.transport_security),
    })
}

#[cfg(test)]
mod gap_contracts;
#[cfg(test)]
mod gap_tests;
#[cfg(test)]
mod metadata_tests;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod transport_security_contracts;
