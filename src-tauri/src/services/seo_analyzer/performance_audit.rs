use crate::models::audit_data::{
    IndexabilityAssessment, Issue, IssueCategory, IssueSeverity, MetaTags,
};
use crate::services::http_client::FetchResult;
use crate::services::seo_analyzer::indexability::{
    assess_indexability, contains_noindex, verify_canonical_target,
};
use std::collections::BTreeMap;

pub async fn audit_performance_and_indexability(
    fetch_result: &FetchResult,
    meta_tags: &MetaTags,
) -> (IndexabilityAssessment, Vec<Issue>) {
    let mut issues = Vec::new();

    if fetch_result.status != 200 {
        issues.push(Issue {
            severity: IssueSeverity::Critical,
            category: IssueCategory::Performance,
            code: Some("performance_http_status".into()),
            params: Some(BTreeMap::from([(
                "status".into(),
                fetch_result.status.to_string(),
            )])),
            message: format!(
                "HTTP response returned non-200 status code: {}",
                fetch_result.status
            ),
            recommendation: Some(
                "Ensure the page returns HTTP 200 OK for search engine crawlers".to_string(),
            ),
        });
    }

    if fetch_result.response_time_ms > 2000 {
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Performance,
            code: Some("performance_response_slow".into()),
            params: Some(BTreeMap::from([(
                "ms".into(),
                fetch_result.response_time_ms.to_string(),
            )])),
            message: format!(
                "Slow server response time: {}ms (recommended < 800ms)",
                fetch_result.response_time_ms
            ),
            recommendation: Some(
                "Optimize TTFB, enable server-side caching, and utilize a fast CDN".to_string(),
            ),
        });
    }

    if fetch_result.redirect_chain.len() > 2 {
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Performance,
            code: Some("performance_redirect_chain".into()),
            params: Some(BTreeMap::from([(
                "hops".into(),
                fetch_result.redirect_chain.len().to_string(),
            )])),
            message: format!(
                "Redirect chain contains {} hops, causing latency and crawling budget loss",
                fetch_result.redirect_chain.len()
            ),
            recommendation: Some("Reduce redirect hops to a direct 301 redirect".to_string()),
        });
    }

    let mut indexability = assess_indexability(
        fetch_result.status,
        meta_tags,
        fetch_result.headers.get("x-robots-tag").cloned(),
        &fetch_result.final_url,
    );
    verify_canonical_target(&mut indexability, fetch_result.status).await;

    if indexability
        .x_robots_tag
        .as_deref()
        .is_some_and(contains_noindex)
    {
        issues.push(Issue {
            severity: IssueSeverity::Critical,
            category: IssueCategory::Technical,
            code: Some("indexability_xrobots_noindex".into()),
            params: None,
            message: "Page has noindex in the X-Robots-Tag response header".to_string(),
            recommendation: Some(
                "Remove the noindex directive from X-Robots-Tag if this page should be indexed."
                    .to_string(),
            ),
        });
    }

    if indexability.canonical_target_checked
        && indexability
            .canonical_target_status
            .is_some_and(|status| status == 0 || status >= 400)
    {
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::MetaTags,
            code: Some("meta_canonical_target".into()),
            params: Some(BTreeMap::from([(
                "status".into(),
                indexability
                    .canonical_target_status
                    .unwrap_or_default()
                    .to_string(),
            )])),
            message: format!(
                "Canonical target returned HTTP {}",
                indexability.canonical_target_status.unwrap_or_default()
            ),
            recommendation: Some("Point rel=canonical to a reachable, indexable URL.".to_string()),
        });
    }

    (indexability, issues)
}

#[cfg(test)]
#[path = "performance_audit_tests.rs"]
mod tests;
