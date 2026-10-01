use crate::models::audit_data::{
    Issue, IssueCategory, IssueSeverity, PageAuditData, TransportSecurityAudit,
};
use crate::services::amp_validator::audit_amp;
use crate::services::html_parser::parse_html;
use crate::services::http_client::FetchResult;
use crate::services::og_parser::parse_social_tags;
use crate::services::security_checker::evaluate_security_headers;
use anyhow::Result;
use chrono::Utc;
use url::Url;

mod accessibility;
mod headings;
mod images;
mod indexability;
mod links;
mod metadata;
mod scoring;
mod transport_security;
use accessibility::audit_accessibility;
use headings::parse_headings;
use images::parse_images;
use indexability::{assess_indexability, contains_noindex, verify_canonical_target};
use links::parse_links;
use metadata::audit_meta_tags;
use scoring::calculate_health_score;
use transport_security::{
    assess_cookie_headers, detect_mixed_content_resources, enrich_header_technologies,
};

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

    // 6. Audit Security Headers
    let sec_result = evaluate_security_headers(&fetch_result.headers);
    let mut sec_issues = sec_result.issues;
    all_issues.append(&mut sec_issues);
    let mixed_content_urls = detect_mixed_content_resources(&fetch_result.body, &parsed_url);
    let cookies = assess_cookie_headers(&fetch_result.set_cookie_headers);
    let is_https = parsed_url.scheme() == "https";
    if !is_https {
        all_issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Security,
            code: Some("transport_http".into()),
            params: Some(std::collections::BTreeMap::from([("scheme".into(), parsed_url.scheme().to_string())])),
            message: format!("Page is served over {} instead of HTTPS", parsed_url.scheme()),
            recommendation: Some("Serve the page and redirect HTTP requests to HTTPS; verify the certificate in a browser or TLS scanner.".into()),
        });
    }
    if !mixed_content_urls.is_empty() {
        all_issues.push(Issue {
            severity: IssueSeverity::Critical,
            category: IssueCategory::Security,
            code: Some("transport_mixed_content".into()),
            params: Some(std::collections::BTreeMap::from([("count".into(), mixed_content_urls.len().to_string())])),
            message: format!("{} HTTP resource(s) are embedded in this HTTPS page (mixed content)", mixed_content_urls.len()),
            recommendation: Some("Load embedded resources over HTTPS or remove them. This static check does not execute scripts or inspect CSS-generated requests.".into()),
        });
    }
    for cookie in &cookies {
        if is_https && !cookie.secure {
            all_issues.push(Issue {
                severity: IssueSeverity::Warning,
                category: IssueCategory::Security,
                code: Some("cookie_secure_missing".into()),
                params: Some(std::collections::BTreeMap::from([(
                    "cookie".into(),
                    cookie.name.clone(),
                )])),
                message: format!("Cookie '{}' is missing the Secure attribute", cookie.name),
                recommendation: Some(
                    "Set Secure on cookies that should only travel over HTTPS.".into(),
                ),
            });
        }
        if !cookie.http_only {
            all_issues.push(Issue {
                severity: IssueSeverity::Info,
                category: IssueCategory::Security,
                code: Some("cookie_httponly_missing".into()),
                params: Some(std::collections::BTreeMap::from([(
                    "cookie".into(),
                    cookie.name.clone(),
                )])),
                message: format!("Cookie '{}' is missing the HttpOnly attribute", cookie.name),
                recommendation: Some(
                    "Set HttpOnly when client-side JavaScript does not need to read this cookie."
                        .into(),
                ),
            });
        }
        if cookie.same_site.is_none() {
            all_issues.push(Issue {
                severity: IssueSeverity::Info,
                category: IssueCategory::Security,
                code: Some("cookie_samesite_missing".into()),
                params: Some(std::collections::BTreeMap::from([(
                    "cookie".into(),
                    cookie.name.clone(),
                )])),
                message: format!("Cookie '{}' does not declare SameSite", cookie.name),
                recommendation: Some(
                    "Choose an explicit SameSite policy appropriate to the cookie's purpose."
                        .into(),
                ),
            });
        }
    }

    // 7. Audit Meta Tags and Canonical
    let mut meta_issues = audit_meta_tags(&html_data.meta_tags, &parsed_url);
    all_issues.append(&mut meta_issues);
    let mut accessibility_issues = audit_accessibility(&html_data.accessibility);
    all_issues.append(&mut accessibility_issues);
    for structured_data in &html_data.structured_data {
        for validation in &structured_data.validation_issues {
            all_issues.push(Issue {
                severity: match validation.severity.as_str() {
                    "info" => IssueSeverity::Info,
                    // Invalid structured data is a warning for the document, not an HTTP failure.
                    "error" | "warning" => IssueSeverity::Warning,
                    _ => IssueSeverity::Info,
                },
                category: IssueCategory::StructuredData,
                code: Some("structured_validation".into()),
                params: Some(std::collections::BTreeMap::from([
                    ("format".into(), structured_data.format.clone()),
                    ("type".into(), structured_data.data_type.clone()),
                    ("detail".into(), validation.message.clone()),
                ])),
                message: format!(
                    "{} ({}): {}",
                    structured_data.format, structured_data.data_type, validation.message
                ),
                recommendation: validation.recommendation.clone(),
            });
        }
    }
    for finding in &amp.findings {
        all_issues.push(Issue {
            severity: match finding.severity.as_str() {
                "error" => IssueSeverity::Critical,
                "warning" => IssueSeverity::Warning,
                _ => IssueSeverity::Info,
            },
            category: IssueCategory::Technical,
            code: Some(format!("amp_{}", finding.code)),
            params: Some(std::collections::BTreeMap::from([
                ("detail".into(), finding.message.clone()),
                ("finding_code".into(), finding.code.clone()),
            ])),
            message: format!("AMP: {} [{}]", finding.message, finding.code),
            recommendation: Some(finding.recommendation.clone()),
        });
    }

    // 8. Audit HTTP Response & Performance
    if fetch_result.status != 200 {
        all_issues.push(Issue {
            severity: IssueSeverity::Critical,
            category: IssueCategory::Performance,
            code: Some("performance_http_status".into()),
            params: Some(std::collections::BTreeMap::from([(
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
        all_issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Performance,
            code: Some("performance_response_slow".into()),
            params: Some(std::collections::BTreeMap::from([(
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
        all_issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Performance,
            code: Some("performance_redirect_chain".into()),
            params: Some(std::collections::BTreeMap::from([(
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
        &html_data.meta_tags,
        fetch_result.headers.get("x-robots-tag").cloned(),
        &fetch_result.final_url,
    );
    verify_canonical_target(&mut indexability, fetch_result.status).await;
    if indexability
        .x_robots_tag
        .as_deref()
        .is_some_and(contains_noindex)
    {
        all_issues.push(Issue {
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
        all_issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::MetaTags,
            code: Some("meta_canonical_target".into()),
            params: Some(std::collections::BTreeMap::from([(
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

    // 9. Calculate Overall Health Score after every indexability signal is evaluated.
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
        security_headers: sec_result.headers,
        structured_data: html_data.structured_data,
        technical: tech,
        health_score,
        issues: all_issues,
        content_stats: html_data.content_stats,
        indexability,
        accessibility: html_data.accessibility,
        amp,
        http_performance: Some(fetch_result.http_performance),
        transport_security: Some(TransportSecurityAudit {
            scheme: parsed_url.scheme().to_string(),
            https: is_https,
            mixed_content_urls,
            cookies,
            tls_coverage: "certificate chain, hostname validation details and negotiated TLS version are not exposed by this HTTP audit".into(),
        }),
    })
}

#[cfg(test)]
mod tests;
