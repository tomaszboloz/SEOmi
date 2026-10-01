use crate::models::audit_data::{
    CookieSecurityFinding, HeadingNode, HeadingsStructure, ImageData, IndexabilityAssessment,
    Issue, IssueCategory, IssueSeverity, LinkData, LinksAnalysis, MetaTags, PageAuditData,
    TechnologySignal, TransportSecurityAudit,
};
use crate::services::amp_validator::audit_amp;
use crate::services::html_parser::{parse_html, resolve_url};
use crate::services::http_client::FetchResult;
use crate::services::og_parser::parse_social_tags;
use crate::services::security_checker::evaluate_security_headers;
use crate::utils::url_validator::validate_and_normalize_url;
use anyhow::Result;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use chrono::Utc;
use scraper::{Html, Selector};
use url::Url;

/// Master SEO analyzer orchestrating all sub-audits
pub async fn analyze_page(fetch_result: FetchResult) -> Result<PageAuditData> {
    let mut all_issues: Vec<Issue> = Vec::new();
    let parsed_url = Url::parse(&fetch_result.final_url).unwrap_or_else(|_| {
        Url::parse(&fetch_result.url).expect("Already validated URL should parse")
    });

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

fn audit_accessibility(audit: &crate::models::audit_data::AccessibilityAudit) -> Vec<Issue> {
    audit
        .findings
        .iter()
        .map(|finding| {
            // Evidence arrays are deliberately capped. Keep the original
            // finding count in params so localized Overview text does not
            // report the cap (for example 50) as the real problem count.
            let finding_count = finding
                .message
                .split_whitespace()
                .find_map(|token| {
                    token
                        .trim_matches(|character: char| !character.is_ascii_digit())
                        .parse::<usize>()
                        .ok()
                })
                .unwrap_or(finding.elements.len());
            let mut params = std::collections::BTreeMap::from([
                ("message".into(), finding.message.clone()),
                ("recommendation".into(), finding.recommendation.clone()),
                ("count".into(), finding_count.to_string()),
            ]);
            match finding.code.as_str() {
                "accessibility-form-controls-unlabeled" => {
                    params.insert(
                        "unlabeled".into(),
                        audit.unlabeled_form_control_count.to_string(),
                    );
                    params.insert("total".into(), audit.form_control_count.to_string());
                }
                "accessibility-document-language-invalid" => {
                    params.insert(
                        "value".into(),
                        finding
                            .evidence
                            .strip_prefix("lang=")
                            .unwrap_or(&finding.evidence)
                            .to_string(),
                    );
                }
                "accessibility-duplicate-id"
                | "accessibility-aria-reference-unresolved"
                | "accessibility-interactive-name-missing" => {
                    params.insert("value".into(), finding.evidence.clone());
                }
                _ => {}
            }
            Issue {
                severity: match finding.severity.as_str() {
                    "error" => IssueSeverity::Critical,
                    "warning" => IssueSeverity::Warning,
                    _ => IssueSeverity::Info,
                },
                category: IssueCategory::Technical,
                code: Some(finding.code.clone()),
                params: Some(params),
                message: format!("Dostępność · {}: {}", finding.code, finding.message),
                recommendation: Some(if finding.elements.is_empty() {
                    finding.recommendation.clone()
                } else {
                    let locations = finding
                        .elements
                        .iter()
                        .take(5)
                        .map(|element| format!("#{} {}", element.dom_position, element.dom_query))
                        .collect::<Vec<_>>()
                        .join("; ");
                    let remaining = finding.elements.len().saturating_sub(5);
                    let suffix = if remaining > 0 {
                        format!("; jeszcze {remaining} w Szczegółach dostępności")
                    } else {
                        "; fragmenty HTML są w Szczegółach dostępności".to_string()
                    };
                    format!(
                        "{} Lokalizacje w DOM: {}{}",
                        finding.recommendation, locations, suffix
                    )
                }),
            }
        })
        .collect()
}

fn enrich_header_technologies(
    signals: &mut Vec<TechnologySignal>,
    headers: &std::collections::HashMap<String, String>,
) {
    let add = |name: &str,
               category: &str,
               evidence: String,
               version: Option<String>,
               output: &mut Vec<TechnologySignal>| {
        if !output
            .iter()
            .any(|signal| signal.name == name && signal.category == category)
        {
            output.push(TechnologySignal {
                name: name.to_string(),
                category: category.to_string(),
                evidence,
                confidence: "confirmed".to_string(),
                version,
            });
        }
    };

    if let Some(server) = headers
        .get("server")
        .filter(|value| !value.trim().is_empty())
    {
        let server = server.trim();
        let (name, version) = parse_header_technology(
            server,
            &["nginx", "Apache", "Caddy", "LiteSpeed", "Microsoft-IIS"],
        );
        add(
            name.as_deref().unwrap_or("Web server"),
            "HTTP server",
            format!("Server: {server}"),
            version,
            signals,
        );
    }
    if let Some(powered_by) = headers
        .get("x-powered-by")
        .filter(|value| !value.trim().is_empty())
    {
        let powered_by = powered_by.trim();
        let (name, version) = parse_header_technology(
            powered_by,
            &["PHP", "ASP.NET", "Express", "Phusion Passenger"],
        );
        add(
            name.as_deref().unwrap_or("Application runtime"),
            "HTTP runtime",
            format!("X-Powered-By: {powered_by}"),
            version,
            signals,
        );
    }
    if headers.contains_key("cf-ray")
        || headers
            .get("server")
            .is_some_and(|value| value.to_ascii_lowercase().contains("cloudflare"))
    {
        add(
            "Cloudflare",
            "CDN / edge",
            "CF-Ray or Server response header confirms Cloudflare.".to_string(),
            None,
            signals,
        );
    }
}

fn detect_mixed_content_resources(html: &str, page_url: &Url) -> Vec<String> {
    if page_url.scheme() != "https" {
        return Vec::new();
    }
    let document = Html::parse_document(html);
    let selector = Selector::parse(
        "script[src], img[src], iframe[src], frame[src], source[src], video[src], audio[src], track[src], embed[src], object[data], form[action], link[rel~='stylesheet'][href], link[rel~='preload'][href]",
    )
    .expect("static embedded-resource selector is valid");
    let mut found = std::collections::BTreeSet::new();
    for element in document.select(&selector) {
        let attribute = if element.value().name() == "object" {
            "data"
        } else if element.value().name() == "form" {
            "action"
        } else if element.value().name() == "link" {
            "href"
        } else {
            "src"
        };
        if let Some(value) = element.value().attr(attribute) {
            collect_http_resource(value, page_url, &mut found);
        }
        if matches!(element.value().name(), "img" | "source") {
            if let Some(srcset) = element.value().attr("srcset") {
                for candidate in srcset.split(',') {
                    if let Some(value) = candidate.split_ascii_whitespace().next() {
                        collect_http_resource(value, page_url, &mut found);
                    }
                }
            }
        }
    }
    let style_selector = Selector::parse("[style]").expect("static style selector is valid");
    for element in document.select(&style_selector) {
        if let Some(style) = element.value().attr("style") {
            for candidate in style.split("url(").skip(1) {
                let value = candidate
                    .trim_start_matches([' ', '\'', '"'])
                    .split([')', '\'', '"'])
                    .next()
                    .unwrap_or_default()
                    .trim();
                collect_http_resource(value, page_url, &mut found);
            }
        }
    }
    found.into_iter().take(100).collect()
}

fn collect_http_resource(
    value: &str,
    page_url: &Url,
    output: &mut std::collections::BTreeSet<String>,
) {
    let value = value.trim();
    if value.is_empty() || value.starts_with("data:") || value.starts_with("blob:") {
        return;
    }
    let Ok(mut resolved) = Url::parse(&resolve_url(value, Some(page_url))) else {
        return;
    };
    if resolved.scheme() != "http" {
        return;
    }
    resolved.set_query(None);
    resolved.set_fragment(None);
    output.insert(resolved.to_string());
}

fn assess_cookie_headers(headers: &[String]) -> Vec<CookieSecurityFinding> {
    headers
        .iter()
        .filter_map(|header| {
            let (pair, attributes) = header
                .split_once(';')
                .map_or((header.as_str(), ""), |(pair, rest)| (pair, rest));
            let (name, _) = pair.split_once('=')?;
            let name = name.trim();
            if name.is_empty()
                || name.len() > 128
                || !name.chars().all(|character| {
                    character.is_ascii_alphanumeric()
                        || matches!(
                            character,
                            '!' | '#'
                                | '$'
                                | '%'
                                | '&'
                                | '\''
                                | '*'
                                | '+'
                                | '-'
                                | '.'
                                | '^'
                                | '_'
                                | '`'
                                | '|'
                                | '~'
                        )
                })
            {
                return None;
            }
            let mut secure = false;
            let mut http_only = false;
            let mut same_site = None;
            for attribute in attributes
                .split(';')
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                let (key, value) = attribute
                    .split_once('=')
                    .map_or((attribute, None), |(key, value)| {
                        (key.trim(), Some(value.trim()))
                    });
                if key.eq_ignore_ascii_case("secure") {
                    secure = true;
                }
                if key.eq_ignore_ascii_case("httponly") {
                    http_only = true;
                }
                if key.eq_ignore_ascii_case("samesite") {
                    same_site = value
                        .filter(|value| {
                            matches!(
                                value.to_ascii_lowercase().as_str(),
                                "strict" | "lax" | "none"
                            )
                        })
                        .map(|value| {
                            match value.to_ascii_lowercase().as_str() {
                                "strict" => "Strict",
                                "lax" => "Lax",
                                _ => "None",
                            }
                            .to_string()
                        });
                }
            }
            Some(CookieSecurityFinding {
                name: name.to_string(),
                secure,
                http_only,
                same_site,
            })
        })
        .take(100)
        .collect()
}

fn parse_header_technology(
    value: &str,
    known_products: &[&str],
) -> (Option<String>, Option<String>) {
    for product in known_products {
        let Some(remainder) = value
            .get(..product.len())
            .filter(|prefix| prefix.eq_ignore_ascii_case(product))
            .and_then(|_| value.get(product.len()..))
        else {
            continue;
        };
        if !remainder.starts_with('/') {
            continue;
        }
        let version = remainder
            .trim_start_matches('/')
            .split_ascii_whitespace()
            .next()
            .and_then(|candidate| {
                let candidate = candidate.trim_end_matches(|character: char| {
                    !character.is_ascii_alphanumeric() && character != '.' && character != '-'
                });
                let digits = candidate.split(['.', '-']).all(|part| {
                    !part.is_empty() && part.chars().all(|character| character.is_ascii_digit())
                });
                (digits && candidate.len() <= 32).then_some(candidate.to_string())
            });
        return (Some((*product).to_string()), version);
    }
    (None, None)
}

fn contains_noindex(value: &str) -> bool {
    value
        .split(|c: char| c == ',' || c.is_whitespace())
        .any(|directive| {
            matches!(
                directive.trim().to_ascii_lowercase().as_str(),
                "noindex" | "none"
            )
        })
}

fn urls_match(left: &str, right: &str) -> bool {
    let normalize = |value: &str| {
        let mut parsed = match Url::parse(value) {
            Ok(value) => value,
            Err(_) => return value.trim_end_matches('/').to_string(),
        };
        parsed.set_fragment(None);
        let normalized = parsed.to_string();
        normalized.trim_end_matches('/').to_string()
    };
    normalize(left) == normalize(right)
}

fn assess_indexability(
    http_status: u16,
    meta_tags: &MetaTags,
    x_robots_tag: Option<String>,
    final_url: &str,
) -> IndexabilityAssessment {
    let meta_robots = meta_tags.robots.clone();
    let canonical = meta_tags.canonical.clone();
    let canonical_matches_final_url = canonical
        .as_deref()
        .map(|value| urls_match(value, final_url));
    let mut reasons = Vec::new();

    if !(200..300).contains(&http_status) {
        reasons.push(format!(
            "Końcowa odpowiedź HTTP ma status {http_status}, a nie 2xx."
        ));
    }
    if meta_robots.as_deref().is_some_and(contains_noindex) {
        reasons.push("Meta robots zawiera dyrektywę noindex lub none.".to_string());
    }
    if x_robots_tag.as_deref().is_some_and(contains_noindex) {
        reasons.push("Nagłówek X-Robots-Tag zawiera dyrektywę noindex lub none.".to_string());
    }

    let blocked = !reasons.is_empty();
    if canonical.is_none() {
        reasons.push("Brak canonical; lokalny audyt nie potwierdza preferowanego URL.".to_string());
    } else if canonical_matches_final_url == Some(false) {
        reasons.push("Canonical wskazuje inny URL; wymaga weryfikacji celu canonical.".to_string());
    }

    IndexabilityAssessment {
        status: if blocked {
            "blocked".to_string()
        } else if reasons.is_empty() {
            "indexable".to_string()
        } else {
            "uncertain".to_string()
        },
        reasons,
        meta_robots,
        x_robots_tag,
        canonical,
        canonical_matches_final_url,
        canonical_target_checked: false,
        canonical_target_status: None,
        canonical_target_check_error: None,
    }
}

async fn verify_canonical_target(assessment: &mut IndexabilityAssessment, current_status: u16) {
    let Some(canonical) = assessment.canonical.as_deref() else {
        return;
    };
    if assessment.canonical_matches_final_url == Some(true) {
        assessment.canonical_target_checked = true;
        assessment.canonical_target_status = Some(current_status);
        return;
    }
    let target = match validate_and_normalize_url(canonical) {
        Ok(target) => target,
        Err(error) => {
            assessment.canonical_target_check_error =
                Some(format!("Canonical target was not requested: {error}"));
            assessment
                .reasons
                .push("Canonical target could not pass the local URL safety policy.".to_string());
            return;
        }
    };
    match crate::services::http_client::check_url_status(target.as_str(), 5).await {
        Ok((status, _)) => {
            assessment.canonical_target_checked = true;
            assessment.canonical_target_status = Some(status);
        }
        Err(error) => {
            assessment.canonical_target_check_error =
                Some(format!("Canonical target check failed: {error}"))
        }
    }
}

fn parse_headings(html_str: &str) -> (HeadingsStructure, Vec<Issue>) {
    let document = Html::parse_document(html_str);
    let mut issues = Vec::new();
    let mut h1_texts = Vec::new();
    let mut flat_headings: Vec<(u8, String)> = Vec::new();

    let heading_selector = Selector::parse("h1, h2, h3, h4, h5, h6").unwrap();
    for el in document.select(&heading_selector) {
        let tag = el.value().name();
        let level = match tag {
            "h1" => 1,
            "h2" => 2,
            "h3" => 3,
            "h4" => 4,
            "h5" => 5,
            "h6" => 6,
            _ => 1,
        };

        let text = el.text().collect::<Vec<_>>().join(" ").trim().to_string();
        if level == 1 {
            h1_texts.push(text.clone());
        }
        flat_headings.push((level, text));
    }

    let h1_count = h1_texts.len();
    let mut struct_issues = Vec::new();

    if h1_count == 0 {
        let msg = "No H1 heading found on page".to_string();
        struct_issues.push(msg.clone());
        issues.push(Issue {
            severity: IssueSeverity::Critical,
            category: IssueCategory::Headings,
            code: Some("headings_h1_missing".into()),
            params: None,
            message: msg,
            recommendation: Some(
                "Add exactly one relevant H1 heading defining the primary page topic".to_string(),
            ),
        });
    } else if h1_count > 1 {
        let msg = format!("Multiple H1 headings found ({} total)", h1_count);
        struct_issues.push(msg.clone());
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Headings,
            code: Some("headings_h1_multiple".into()),
            params: Some(std::collections::BTreeMap::from([(
                "count".into(),
                h1_count.to_string(),
            )])),
            message: msg,
            recommendation: Some(
                "Ensure the page has only one primary H1 for optimal SEO semantics".to_string(),
            ),
        });
    }

    // Validate hierarchy level jumps
    let mut has_valid_hierarchy = true;
    let mut prev_level: Option<u8> = None;

    for (lvl, txt) in &flat_headings {
        if let Some(prev) = prev_level {
            if *lvl > prev + 1 {
                has_valid_hierarchy = false;
                let msg = format!(
                    "Skipped heading level: H{} followed directly by H{} ('{}')",
                    prev, lvl, txt
                );
                struct_issues.push(msg.clone());
                issues.push(Issue {
                    severity: IssueSeverity::Warning,
                    category: IssueCategory::Headings,
                    code: Some("headings_hierarchy_skip".into()),
                    params: Some(std::collections::BTreeMap::from([
                        ("previous".into(), prev.to_string()),
                        ("level".into(), lvl.to_string()),
                        ("text".into(), txt.clone()),
                    ])),
                    message: msg,
                    recommendation: Some("Maintain sequential heading hierarchy without skipping levels for accessibility and SEO".to_string()),
                });
            }
        }
        prev_level = Some(*lvl);
    }

    let hierarchy = build_heading_tree(&flat_headings);

    let structure = HeadingsStructure {
        h1_count,
        h1_texts,
        hierarchy,
        has_valid_hierarchy,
        issues: struct_issues,
    };

    (structure, issues)
}

fn build_heading_tree(flat: &[(u8, String)]) -> Vec<HeadingNode> {
    let mut roots: Vec<HeadingNode> = Vec::new();
    for (lvl, txt) in flat {
        append_heading_node(&mut roots, *lvl, txt);
    }
    roots
}

fn append_heading_node(nodes: &mut Vec<HeadingNode>, level: u8, text: &str) {
    if let Some(last) = nodes.last_mut() {
        if last.level < level {
            append_heading_node(&mut last.children, level, text);
            return;
        }
    }
    nodes.push(HeadingNode {
        level,
        text: text.to_string(),
        children: Vec::new(),
    });
}

fn infer_image_format(src: &str) -> Option<String> {
    let clean = src.split('?').next().unwrap_or(src);
    let clean = clean.split('#').next().unwrap_or(clean).to_lowercase();
    if clean.starts_with("data:image/") {
        let fmt = clean
            .trim_start_matches("data:image/")
            .split(';')
            .next()
            .unwrap_or("");
        return Some(fmt.to_string());
    }
    if clean.ends_with(".webp") {
        Some("webp".to_string())
    } else if clean.ends_with(".avif") {
        Some("avif".to_string())
    } else if clean.ends_with(".svg") {
        Some("svg".to_string())
    } else if clean.ends_with(".png") {
        Some("png".to_string())
    } else if clean.ends_with(".jpg") || clean.ends_with(".jpeg") {
        Some("jpeg".to_string())
    } else if clean.ends_with(".gif") {
        Some("gif".to_string())
    } else if clean.ends_with(".ico") {
        Some("ico".to_string())
    } else {
        None
    }
}

fn parse_dimension_token(value: &str) -> Option<usize> {
    let trimmed = value.trim();
    if trimmed.ends_with('%') {
        return None;
    }
    let digits = trimmed
        .chars()
        .take_while(|character| character.is_ascii_digit())
        .collect::<String>();
    if digits.is_empty() {
        return None;
    }
    let suffix = trimmed[digits.len()..].trim().to_ascii_lowercase();
    if !suffix.is_empty() && suffix != "px" {
        return None;
    }
    digits
        .parse::<usize>()
        .ok()
        .filter(|value| *value > 0 && *value <= 100_000)
}

fn read_be_u16(bytes: &[u8], offset: usize) -> Option<usize> {
    let end = offset.checked_add(2)?;
    Some(u16::from_be_bytes(bytes.get(offset..end)?.try_into().ok()?) as usize)
}

fn read_be_u32(bytes: &[u8], offset: usize) -> Option<usize> {
    let end = offset.checked_add(4)?;
    Some(u32::from_be_bytes(bytes.get(offset..end)?.try_into().ok()?) as usize)
}

fn read_le_u16(bytes: &[u8], offset: usize) -> Option<usize> {
    let end = offset.checked_add(2)?;
    Some(u16::from_le_bytes(bytes.get(offset..end)?.try_into().ok()?) as usize)
}

fn read_le_u24(bytes: &[u8], offset: usize) -> Option<usize> {
    let end = offset.checked_add(3)?;
    let value = bytes.get(offset..end)?;
    Some((value[0] as usize) | ((value[1] as usize) << 8) | ((value[2] as usize) << 16))
}

fn percent_decode_data(value: &str) -> Option<String> {
    fn hex_nibble(byte: u8) -> Option<u8> {
        match byte {
            b'0'..=b'9' => Some(byte - b'0'),
            b'a'..=b'f' => Some(byte - b'a' + 10),
            b'A'..=b'F' => Some(byte - b'A' + 10),
            _ => None,
        }
    }
    let mut output = Vec::with_capacity(value.len());
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let high = hex_nibble(*bytes.get(index + 1)?)?;
            let low = hex_nibble(*bytes.get(index + 2)?)?;
            output.push((high << 4) | low);
            index += 3;
        } else {
            output.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(output).ok()
}

fn svg_data_uri_dimensions(text: &str) -> Option<(usize, usize)> {
    let document = Html::parse_document(text);
    let selector = Selector::parse("svg").ok()?;
    let svg = document.select(&selector).next()?;
    let width = svg.value().attr("width").and_then(parse_dimension_token);
    let height = svg.value().attr("height").and_then(parse_dimension_token);
    if let (Some(width), Some(height)) = (width, height) {
        return Some((width, height));
    }
    let view_box = svg
        .value()
        .attr("viewBox")
        .or_else(|| svg.value().attr("viewbox"))?;
    let values = view_box
        .split(|character: char| character.is_ascii_whitespace() || character == ',')
        .filter_map(|value| value.trim().parse::<f64>().ok())
        .collect::<Vec<_>>();
    (values.len() >= 4 && values[2] > 0.0 && values[3] > 0.0)
        .then_some((values[2] as usize, values[3] as usize))
}

/// Decode only bounded, local data-URI metadata. Network images intentionally
/// remain attribute-only until an optional resource request is performed.
fn intrinsic_data_uri_dimensions(src: &str) -> Option<(usize, usize)> {
    let (header, payload) = src.split_once(',')?;
    let header_lower = header.to_ascii_lowercase();
    if !header_lower.starts_with("data:image/") {
        return None;
    }
    if header_lower.contains("svg+xml") {
        let decoded = if header_lower.contains(";base64") {
            String::from_utf8(BASE64_STANDARD.decode(payload).ok()?).ok()?
        } else {
            percent_decode_data(payload)?
        };
        return svg_data_uri_dimensions(&decoded);
    }
    let bytes = BASE64_STANDARD.decode(payload).ok()?;
    if bytes.len() > 8 * 1024 * 1024 {
        return None;
    }
    if header_lower.contains("png") && bytes.get(0..8) == Some(&[137, 80, 78, 71, 13, 10, 26, 10]) {
        return Some((read_be_u32(&bytes, 16)?, read_be_u32(&bytes, 20)?));
    }
    if header_lower.contains("gif")
        && (bytes.get(0..6) == Some(b"GIF87a") || bytes.get(0..6) == Some(b"GIF89a"))
    {
        return Some((read_le_u16(&bytes, 6)?, read_le_u16(&bytes, 8)?));
    }
    if header_lower.contains("webp")
        && bytes.get(0..4) == Some(b"RIFF")
        && bytes.get(8..12) == Some(b"WEBP")
        && bytes.get(12..16) == Some(b"VP8X")
    {
        return Some((
            read_le_u24(&bytes, 24)?.saturating_add(1),
            read_le_u24(&bytes, 27)?.saturating_add(1),
        ));
    }
    if (header_lower.contains("jpeg") || header_lower.contains("jpg"))
        && bytes.get(0..2) == Some(&[0xff, 0xd8])
    {
        let mut offset = 2usize;
        while offset + 4 <= bytes.len() {
            if bytes[offset] != 0xff {
                offset += 1;
                continue;
            }
            while offset < bytes.len() && bytes[offset] == 0xff {
                offset += 1;
            }
            let marker = *bytes.get(offset)?;
            offset += 1;
            if marker == 0xd8 || marker == 0xd9 {
                continue;
            }
            let length = read_be_u16(&bytes, offset)?;
            if length < 2 || offset + length > bytes.len() {
                return None;
            }
            let is_sof = matches!(marker, 0xc0..=0xc3 | 0xc5..=0xc7 | 0xc9..=0xcb | 0xcd..=0xcf);
            if is_sof && length >= 7 {
                return Some((
                    read_be_u16(&bytes, offset + 5)?,
                    read_be_u16(&bytes, offset + 3)?,
                ));
            }
            offset += length;
        }
    }
    None
}

fn parse_images(html_str: &str, base_url: &Url) -> (Vec<ImageData>, Vec<Issue>) {
    let document = Html::parse_document(html_str);
    let mut images = Vec::new();
    let mut issues = Vec::new();

    let img_selector = Selector::parse("img").unwrap();
    let mut missing_alt_count = 0;
    let mut missing_dim_count = 0;

    for el in document.select(&img_selector) {
        let src_attr = el.value().attr("src").unwrap_or("").trim();
        if src_attr.is_empty() {
            continue;
        }

        let full_src = resolve_url(src_attr, Some(base_url));
        let alt = el.value().attr("alt").map(|s| s.trim().to_string());
        let intrinsic_dimensions = intrinsic_data_uri_dimensions(&full_src);
        let width = el
            .value()
            .attr("width")
            .map(|s| s.trim().to_string())
            .or_else(|| intrinsic_dimensions.map(|dimensions| dimensions.0.to_string()));
        let height = el
            .value()
            .attr("height")
            .map(|s| s.trim().to_string())
            .or_else(|| intrinsic_dimensions.map(|dimensions| dimensions.1.to_string()));
        let has_width_attribute = el.value().attr("width").is_some();
        let has_height_attribute = el.value().attr("height").is_some();
        let dimensions_source = if has_width_attribute && has_height_attribute {
            Some("attributes".to_string())
        } else if intrinsic_dimensions.is_some() {
            Some(if has_width_attribute || has_height_attribute {
                "mixed".to_string()
            } else {
                "intrinsic-data-uri".to_string()
            })
        } else {
            None
        };
        let loading = el.value().attr("loading").map(|s| s.trim().to_string());
        let srcset = el.value().attr("srcset").map(|s| s.trim().to_string());

        // The empty alt attribute is itself the HTML signal for a decorative
        // image. aria-hidden/role are optional, not prerequisites.
        let decorative = alt.as_deref().is_some_and(|value| value.trim().is_empty());
        let has_alt = decorative || matches!(&alt, Some(value) if !value.trim().is_empty());

        if !has_alt && !decorative {
            missing_alt_count += 1;
        }

        if width.is_none() || height.is_none() {
            missing_dim_count += 1;
        }

        let format = infer_image_format(&full_src);

        images.push(ImageData {
            src: full_src,
            alt,
            width,
            height,
            loading,
            srcset,
            has_alt,
            format,
            dimensions_source,
        });
    }

    if missing_alt_count > 0 {
        let severity = if missing_alt_count > 5 {
            IssueSeverity::Critical
        } else {
            IssueSeverity::Warning
        };

        issues.push(Issue {
            severity,
            category: IssueCategory::Images,
            code: Some("images_alt_missing".into()),
            params: Some(std::collections::BTreeMap::from([("count".into(), missing_alt_count.to_string())])),
            message: format!("{} image(s) missing 'alt' descriptive text", missing_alt_count),
            recommendation: Some("Add descriptive alt attributes to all meaningful images for accessibility and image search ranking".to_string()),
        });
    }

    if missing_dim_count > 0 {
        issues.push(Issue {
            severity: IssueSeverity::Info,
            category: IssueCategory::Images,
            code: Some("images_dimensions_missing".into()),
            params: Some(std::collections::BTreeMap::from([("count".into(), missing_dim_count.to_string())])),
            message: format!("{} image(s) missing explicit width/height dimensions (CLS risk)", missing_dim_count),
            recommendation: Some("Specify explicit width and height attributes on <img> elements to prevent Cumulative Layout Shift (CLS)".to_string()),
        });
    }

    (images, issues)
}

fn parse_links(html_str: &str, base_url: &Url) -> (LinksAnalysis, Vec<Issue>) {
    let document = Html::parse_document(html_str);
    let mut links = Vec::new();
    let mut issues = Vec::new();

    let a_selector = Selector::parse("a[href]").unwrap();
    let base_host = base_url.host_str().unwrap_or("").to_lowercase();

    let mut internal_count = 0;
    let mut external_count = 0;
    let mut nofollow_count = 0;
    let mut unsafe_blank_count = 0;
    let mut insecure_count = 0;

    for el in document.select(&a_selector) {
        let href_raw = el.value().attr("href").unwrap_or("").trim();
        if href_raw.is_empty() || href_raw.starts_with('#') || href_raw.starts_with("javascript:") {
            continue;
        }

        let full_href = resolve_url(href_raw, Some(base_url));
        let text = el.text().collect::<Vec<_>>().join(" ").trim().to_string();
        let rel = el.value().attr("rel").map(|s| s.trim().to_string());
        let target = el.value().attr("target").map(|s| s.trim().to_string());

        let is_internal = if let Ok(parsed_href) = Url::parse(&full_href) {
            let link_host = parsed_href.host_str().unwrap_or("").to_lowercase();
            link_host.is_empty()
                || link_host == base_host
                || link_host.ends_with(&format!(".{}", base_host))
        } else {
            true
        };

        if is_internal {
            internal_count += 1;
        } else {
            external_count += 1;
        }

        let is_nofollow = rel
            .as_ref()
            .map(|r| r.to_lowercase().contains("nofollow"))
            .unwrap_or(false);

        if is_nofollow {
            nofollow_count += 1;
        }

        let is_insecure = base_url.scheme() == "https" && full_href.starts_with("http://");
        if is_insecure {
            insecure_count += 1;
        }

        // Check for target="_blank" without rel="noopener noreferrer"
        if let Some(ref t) = target {
            if t == "_blank" {
                let rel_str = rel.as_deref().unwrap_or("").to_lowercase();
                if !rel_str.contains("noopener") && !rel_str.contains("noreferrer") {
                    unsafe_blank_count += 1;
                }
            }
        }

        links.push(LinkData {
            href: full_href,
            text,
            is_internal,
            rel,
            target,
            is_insecure,
        });
    }

    if unsafe_blank_count > 0 {
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Links,
            code: Some("links_target_blank".into()),
            params: Some(std::collections::BTreeMap::from([("count".into(), unsafe_blank_count.to_string())])),
            message: format!(
                "{} external link(s) use target='_blank' without rel='noopener noreferrer'",
                unsafe_blank_count
            ),
            recommendation: Some("Add rel='noopener noreferrer' to external links with target='_blank' to prevent tabnabbing security vulnerability".to_string()),
        });
    }

    if insecure_count > 0 {
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Links,
            code: Some("links_insecure".into()),
            params: Some(std::collections::BTreeMap::from([("count".into(), insecure_count.to_string())])),
            message: format!(
                "{} link destination(s) use HTTP on an HTTPS page; these are navigation links, not embedded mixed content",
                insecure_count
            ),
            recommendation: Some("Prefer HTTPS destinations for privacy and integrity. Embedded HTTP resources are reported separately as mixed content.".to_string()),
        });
    }

    let analysis = LinksAnalysis {
        total_links: links.len(),
        internal_links: internal_count,
        external_links: external_count,
        nofollow_links: nofollow_count,
        links,
    };

    (analysis, issues)
}

fn audit_meta_tags(meta: &crate::models::audit_data::MetaTags, _base_url: &Url) -> Vec<Issue> {
    let mut issues = Vec::new();

    // Title checks
    match &meta.title {
        None => {
            issues.push(Issue {
                severity: IssueSeverity::Critical,
                category: IssueCategory::MetaTags,
                code: Some("meta_title_missing".into()),
                params: None,
                message: "Missing page <title> tag".to_string(),
                recommendation: Some(
                    "Provide an informative title between 50-60 characters".to_string(),
                ),
            });
        }
        Some(t) => {
            let len = t.chars().count();
            if len < 20 {
                issues.push(Issue {
                    severity: IssueSeverity::Warning,
                    category: IssueCategory::MetaTags,
                    code: Some("meta_title_short".into()),
                    params: Some(std::collections::BTreeMap::from([(
                        "count".into(),
                        len.to_string(),
                    )])),
                    message: format!("Page title is too short ({} characters)", len),
                    recommendation: Some(
                        "Expand title to 40-60 characters with primary keywords".to_string(),
                    ),
                });
            } else if len > 65 {
                issues.push(Issue {
                    severity: IssueSeverity::Warning,
                    category: IssueCategory::MetaTags,
                    code: Some("meta_title_long".into()),
                    params: Some(std::collections::BTreeMap::from([("count".into(), len.to_string())])),
                    message: format!("Page title is too long ({} characters), risks truncation in SERP", len),
                    recommendation: Some("Keep title under 60-65 characters to prevent truncation in Google search results".to_string()),
                });
            }
        }
    }

    // Description checks
    match &meta.description {
        None => {
            issues.push(Issue {
                severity: IssueSeverity::Critical,
                category: IssueCategory::MetaTags,
                code: Some("meta_description_missing".into()),
                params: None,
                message: "Missing meta description tag".to_string(),
                recommendation: Some(
                    "Add a compelling meta description between 120-160 characters".to_string(),
                ),
            });
        }
        Some(d) => {
            let len = d.chars().count();
            if len < 60 {
                issues.push(Issue {
                    severity: IssueSeverity::Warning,
                    category: IssueCategory::MetaTags,
                    code: Some("meta_description_short".into()),
                    params: Some(std::collections::BTreeMap::from([(
                        "count".into(),
                        len.to_string(),
                    )])),
                    message: format!("Meta description is too short ({} characters)", len),
                    recommendation: Some(
                        "Expand meta description to 120-160 characters".to_string(),
                    ),
                });
            } else if len > 165 {
                issues.push(Issue {
                    severity: IssueSeverity::Warning,
                    category: IssueCategory::MetaTags,
                    code: Some("meta_description_long".into()),
                    params: Some(std::collections::BTreeMap::from([(
                        "count".into(),
                        len.to_string(),
                    )])),
                    message: format!("Meta description is too long ({} characters)", len),
                    recommendation: Some(
                        "Shorten meta description to under 160 characters".to_string(),
                    ),
                });
            }
        }
    }

    // Canonical checks
    if meta.canonical.is_none() {
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::MetaTags,
            code: Some("meta_canonical_missing".into()),
            params: None,
            message: "Missing canonical link tag".to_string(),
            recommendation: Some(
                "Specify rel='canonical' to avoid duplicate content penalties".to_string(),
            ),
        });
    }

    // Viewport check (Mobile friendliness)
    if meta.viewport.is_none() {
        issues.push(Issue {
            severity: IssueSeverity::Critical,
            category: IssueCategory::Technical,
            code: Some("meta_viewport_missing".into()),
            params: None,
            message: "Missing viewport meta tag (Mobile usability failure)".to_string(),
            recommendation: Some(
                "Add <meta name='viewport' content='width=device-width, initial-scale=1.0'>"
                    .to_string(),
            ),
        });
    }

    // Robots check
    if let Some(ref r) = meta.robots {
        let r_lower = r.to_lowercase();
        if r_lower.contains("noindex") {
            issues.push(Issue {
                severity: IssueSeverity::Critical,
                category: IssueCategory::MetaTags,
                code: Some("meta_robots_noindex".into()),
                params: Some(std::collections::BTreeMap::from([(
                    "value".into(),
                    r.clone(),
                )])),
                message: "Page has 'noindex' in robots meta tag (preventing indexing in Google)"
                    .to_string(),
                recommendation: Some(
                    "Remove 'noindex' if this page is intended to be indexed by search engines"
                        .to_string(),
                ),
            });
        }
    }

    issues
}

fn calculate_health_score(issues: &[Issue], http_status: u16) -> u8 {
    if http_status >= 400 {
        return 0;
    }

    let mut score: i32 = 100;
    for issue in issues {
        match issue.severity {
            IssueSeverity::Critical => score -= 15,
            IssueSeverity::Warning => score -= 5,
            IssueSeverity::Info => score -= 1,
        }
    }

    score.clamp(0, 100) as u8
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::audit_data::HttpPerformanceMeasurement;
    use std::collections::HashMap;

    fn test_http_performance() -> HttpPerformanceMeasurement {
        HttpPerformanceMeasurement {
            measured_at: Utc::now(),
            method: "GET".into(),
            response_headers_ms: 100,
            body_read_ms: 2,
            total_request_ms: 102,
            decoded_body_bytes: 64,
            content_length_header_bytes: None,
            redirect_hops: 0,
            scope: "native_http_get_includes_redirects_no_browser_render".into(),
        }
    }

    #[tokio::test]
    async fn test_analyze_page_healthy() {
        let html = r#"
        <!DOCTYPE html>
        <html>
          <head>
            <title>Optimal Page Title For Search Engine Testing | SEOmi</title>
            <meta name="description" content="A perfectly sized meta description that easily conveys the complete topic of the article to visitors and search engines alike.">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="canonical" href="https://example.com/test">
            <meta property="og:title" content="Optimal Page Title">
          </head>
          <body>
            <h1>Main Topic Header</h1>
            <p>Content text</p>
            <h2>Sub Topic Header</h2>
            <img src="/logo.png" alt="Company Logo" width="100" height="100">
            <a href="/about">About Us</a>
          </body>
        </html>
        "#;

        let fetch = FetchResult {
            url: "https://example.com/test".to_string(),
            final_url: "https://example.com/test".to_string(),
            status: 200,
            response_time_ms: 150,
            headers: HashMap::from([
                (
                    "strict-transport-security".to_string(),
                    "max-age=31536000".to_string(),
                ),
                (
                    "content-security-policy".to_string(),
                    "default-src 'self'".to_string(),
                ),
                ("x-frame-options".to_string(), "DENY".to_string()),
                ("x-content-type-options".to_string(), "nosniff".to_string()),
            ]),
            set_cookie_headers: Vec::new(),
            redirect_chain: Vec::new(),
            body: html.to_string(),
            http_performance: test_http_performance(),
        };

        let result = analyze_page(fetch).await.unwrap();
        assert!(result.health_score >= 80);
        assert_eq!(result.headings.h1_count, 1);
        assert_eq!(result.images.len(), 1);
        assert!(result.images[0].has_alt);
        assert_eq!(result.links.total_links, 1);
        assert!(result.links.links[0].is_internal);
        assert_eq!(result.indexability.status, "indexable");
        assert_eq!(
            result
                .http_performance
                .as_ref()
                .unwrap()
                .response_headers_ms,
            100
        );
        assert_eq!(
            result.http_performance.as_ref().unwrap().decoded_body_bytes,
            64
        );
    }

    #[tokio::test]
    async fn schema_validation_findings_are_added_to_the_saved_audit_issues() {
        let html = r#"<!DOCTYPE html><html lang="en"><head>
          <title>Structured data validation test page title</title>
          <meta name="description" content="This description is long enough to remain a stable fixture for the local schema validation test and audit.">
          <meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="https://example.com/product">
          <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","description":"No required profile fields"}</script>
        </head><body><h1>Product test</h1><main><p>Visible content.</p></main></body></html>"#;
        let fetch = FetchResult {
            url: "https://example.com/product".into(),
            final_url: "https://example.com/product".into(),
            status: 200,
            response_time_ms: 120,
            headers: HashMap::new(),
            set_cookie_headers: Vec::new(),
            redirect_chain: Vec::new(),
            body: html.into(),
            http_performance: test_http_performance(),
        };

        let result = analyze_page(fetch).await.unwrap();
        assert!(result.structured_data[0]
            .validation_issues
            .iter()
            .any(|item| item.code == "product-name-missing"));
        assert!(result.issues.iter().any(|item| {
            item.category == IssueCategory::StructuredData
                && item.code.as_deref() == Some("structured_validation")
                && item.message.contains("Product has no name")
                && item
                    .params
                    .as_ref()
                    .and_then(|params| params.get("detail"))
                    .is_some_and(|detail| detail.contains("Product has no name"))
        }));
    }

    #[tokio::test]
    async fn amp_local_findings_are_persisted_and_affect_the_audit_score() {
        let fetch = FetchResult {
            url: "https://example.com/amp".into(),
            final_url: "https://example.com/amp".into(),
            status: 200,
            response_time_ms: 100,
            headers: HashMap::new(),
            set_cookie_headers: Vec::new(),
            redirect_chain: Vec::new(),
            body: "<html amp><head></head><body><p>AMP test</p></body></html>".into(),
            http_performance: test_http_performance(),
        };

        let report = analyze_page(fetch).await.unwrap();
        assert!(report.amp.is_amp_document);
        assert!(report
            .amp
            .findings
            .iter()
            .any(|finding| finding.code == "amp-canonical-missing"));
        assert!(report
            .issues
            .iter()
            .any(|issue| issue.message.contains("[amp-canonical-missing]")));
        assert!(report.health_score < 100);
    }

    #[tokio::test]
    async fn accessibility_findings_are_added_to_the_audit_and_health_score() {
        let fetch = FetchResult {
            url: "https://example.com/accessibility".into(),
            final_url: "https://example.com/accessibility".into(),
            status: 200,
            response_time_ms: 100,
            headers: HashMap::new(),
            set_cookie_headers: Vec::new(),
            redirect_chain: Vec::new(),
            body: "<!doctype html><html lang=\"en_US\"><head><title>Accessibility audit test page</title><meta name=\"description\" content=\"A long enough description for an audit fixture that contains stable text for the page.\"><meta name=\"viewport\" content=\"width=device-width\"><link rel=\"canonical\" href=\"https://example.com/accessibility\"></head><body><main><h1>Accessibility</h1><input type=\"email\" name=\"contact\" value=\"must-not-leak\"><button></button><img src=\"/chart.png\"></main></body></html>".into(),
            http_performance: test_http_performance(),
        };

        let result = analyze_page(fetch).await.unwrap();
        assert!(result
            .accessibility
            .findings
            .iter()
            .any(|finding| finding.code == "accessibility-document-language-invalid"));
        assert!(result.issues.iter().any(|issue| issue
            .message
            .contains("Dostępność · accessibility-image-alt-missing")));
        let unlabeled_issue = result
            .issues
            .iter()
            .find(|issue| {
                issue
                    .message
                    .contains("accessibility-form-controls-unlabeled")
            })
            .unwrap();
        assert_eq!(
            unlabeled_issue.code.as_deref(),
            Some("accessibility-form-controls-unlabeled")
        );
        assert_eq!(
            unlabeled_issue
                .params
                .as_ref()
                .and_then(|params| params.get("unlabeled"))
                .map(String::as_str),
            Some("1")
        );
        assert_eq!(
            unlabeled_issue
                .params
                .as_ref()
                .and_then(|params| params.get("total"))
                .map(String::as_str),
            Some("1")
        );
        assert!(unlabeled_issue
            .recommendation
            .as_deref()
            .unwrap_or_default()
            .contains("document.querySelectorAll('input, select, textarea')[0]"));
        assert!(result
            .accessibility
            .findings
            .iter()
            .find(|finding| finding.code == "accessibility-form-controls-unlabeled")
            .unwrap()
            .elements
            .iter()
            .all(|element| !element.html_snippet.contains("must-not-leak")));
        assert!(result.health_score < 100);
    }

    #[test]
    fn detects_noindex_from_x_robots_tag() {
        let meta = MetaTags {
            canonical: Some("https://example.com/page".to_string()),
            ..Default::default()
        };
        let assessment = assess_indexability(
            200,
            &meta,
            Some("googlebot: noindex, nofollow".to_string()),
            "https://example.com/page",
        );

        assert_eq!(assessment.status, "blocked");
        assert!(assessment
            .reasons
            .iter()
            .any(|reason| reason.contains("X-Robots-Tag")));
    }

    #[tokio::test]
    async fn x_robots_noindex_is_exposed_in_the_audit_and_health_issues() {
        let fetch = FetchResult {
            url: "https://example.com/page".to_string(),
            final_url: "https://example.com/page".to_string(),
            status: 200,
            response_time_ms: 120,
            headers: HashMap::from([("x-robots-tag".to_string(), "noindex".to_string())]),
            set_cookie_headers: Vec::new(),
            redirect_chain: Vec::new(),
            body: "<html><head><title>Wystarczająco długi tytuł testowej strony</title><meta name=\"description\" content=\"Wystarczająco długi opis testowej strony dla walidacji lokalnego audytu.\"><meta name=\"viewport\" content=\"width=device-width\"><link rel=\"canonical\" href=\"https://example.com/page\"></head><body><h1>Temat</h1></body></html>".to_string(),
            http_performance: test_http_performance(),
        };

        let result = analyze_page(fetch).await.unwrap();
        assert_eq!(result.indexability.status, "blocked");
        assert!(result.issues.iter().any(|issue| {
            issue.code.as_deref() == Some("indexability_xrobots_noindex")
                && issue.message.contains("X-Robots-Tag")
        }));
    }

    #[test]
    fn marks_different_canonical_as_uncertain_without_calling_it_a_block() {
        let meta = MetaTags {
            canonical: Some("https://example.com/preferred".to_string()),
            ..Default::default()
        };
        let assessment = assess_indexability(200, &meta, None, "https://example.com/alternate");

        assert_eq!(assessment.status, "uncertain");
        assert_eq!(assessment.canonical_matches_final_url, Some(false));
    }

    #[test]
    fn structured_data_warning_reduces_the_health_score() {
        let structured_data_issue = Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::StructuredData,
            code: Some("structured_validation".into()),
            params: None,
            message: "JSON-LD Product has no name".into(),
            recommendation: Some("Add a name property.".into()),
        };

        assert_eq!(calculate_health_score(&[], 200), 100);
        assert_eq!(calculate_health_score(&[structured_data_issue], 200), 95);
    }

    #[tokio::test]
    async fn rejects_private_canonical_target_without_sending_a_request() {
        let mut assessment = assess_indexability(
            200,
            &MetaTags {
                canonical: Some("http://127.0.0.1/internal".to_string()),
                ..Default::default()
            },
            None,
            "https://example.com/page",
        );

        verify_canonical_target(&mut assessment, 200).await;
        assert!(!assessment.canonical_target_checked);
        assert!(assessment
            .canonical_target_check_error
            .as_deref()
            .is_some_and(|value| value.contains("not requested")));
    }

    #[tokio::test]
    async fn reuses_current_http_status_for_a_self_canonical() {
        let mut assessment = assess_indexability(
            200,
            &MetaTags {
                canonical: Some("https://example.com/page".to_string()),
                ..Default::default()
            },
            None,
            "https://example.com/page",
        );

        verify_canonical_target(&mut assessment, 200).await;
        assert!(assessment.canonical_target_checked);
        assert_eq!(assessment.canonical_target_status, Some(200));
    }

    #[test]
    fn adds_only_explicit_http_technology_evidence() {
        let mut signals = Vec::new();
        enrich_header_technologies(
            &mut signals,
            &HashMap::from([
                ("server".to_string(), "cloudflare".to_string()),
                ("x-powered-by".to_string(), "Express".to_string()),
                ("cf-ray".to_string(), "abc-WAW".to_string()),
            ]),
        );

        assert!(signals.iter().any(|signal| signal.name == "Cloudflare"));
        assert!(signals
            .iter()
            .any(|signal| signal.name == "Application runtime"
                && signal.evidence.contains("Express")));
        assert!(signals
            .iter()
            .all(|signal| signal.confidence == "confirmed"));
    }

    #[test]
    fn reports_http_technology_versions_only_for_recognized_versioned_signatures() {
        let mut signals = Vec::new();
        enrich_header_technologies(
            &mut signals,
            &HashMap::from([
                ("server".to_string(), "nginx/1.27.4".to_string()),
                ("x-powered-by".to_string(), "PHP/8.3.3".to_string()),
            ]),
        );
        let nginx = signals
            .iter()
            .find(|signal| signal.name == "nginx")
            .unwrap();
        let php = signals.iter().find(|signal| signal.name == "PHP").unwrap();
        assert_eq!(nginx.version.as_deref(), Some("1.27.4"));
        assert_eq!(php.version.as_deref(), Some("8.3.3"));
        assert!(signals
            .iter()
            .all(|signal| signal.confidence == "confirmed"));

        let mut unknown = Vec::new();
        enrich_header_technologies(
            &mut unknown,
            &HashMap::from([("server".to_string(), "mystery/9.8".to_string())]),
        );
        assert_eq!(unknown[0].name, "Web server");
        assert_eq!(unknown[0].version, None);
    }

    #[test]
    fn distinguishes_mixed_content_resources_from_http_navigation_links() {
        let page_url = Url::parse("https://example.com/page").unwrap();
        let html = r#"<html><body>
            <a href="http://example.com/archive">ordinary navigation</a>
            <img src="http://cdn.example.test/photo.jpg?token=secret" srcset="http://cdn.example.test/small.jpg 1x, https://cdn.example.test/large.jpg 2x">
            <script src="//cdn.example.test/app.js"></script>
            <div style="background-image:url('http://cdn.example.test/bg.png?key=secret')"></div>
        </body></html>"#;
        let resources = detect_mixed_content_resources(html, &page_url);

        assert_eq!(resources.len(), 3);
        assert!(resources
            .iter()
            .any(|url| url == "http://cdn.example.test/photo.jpg"));
        assert!(resources
            .iter()
            .any(|url| url == "http://cdn.example.test/small.jpg"));
        assert!(resources
            .iter()
            .any(|url| url == "http://cdn.example.test/bg.png"));
        assert!(resources.iter().all(|url| !url.contains("secret")));
        assert!(resources.iter().all(|url| !url.contains("/archive")));
        assert!(
            detect_mixed_content_resources(html, &Url::parse("http://example.com/").unwrap())
                .is_empty()
        );
    }

    #[test]
    fn cookie_assessment_keeps_only_names_and_security_attributes() {
        let cookies = assess_cookie_headers(&[
            "session=private-value; Path=/; Secure; HttpOnly; SameSite=Lax".into(),
            "prefs=also-private; Path=/".into(),
            "malformed-cookie".into(),
        ]);

        assert_eq!(cookies.len(), 2);
        assert_eq!(cookies[0].name, "session");
        assert!(cookies[0].secure && cookies[0].http_only);
        assert_eq!(cookies[0].same_site.as_deref(), Some("Lax"));
        assert_eq!(cookies[1].name, "prefs");
        assert!(!cookies[1].secure && !cookies[1].http_only);
        let serialized = serde_json::to_string(&cookies).unwrap();
        assert!(!serialized.contains("private-value"));
        assert!(!serialized.contains("also-private"));
    }

    #[tokio::test]
    async fn saves_transport_and_cookie_findings_without_cookie_values() {
        let fetch = FetchResult {
            url: "https://example.com/secure".into(),
            final_url: "https://example.com/secure".into(),
            status: 200,
            response_time_ms: 100,
            headers: HashMap::new(),
            set_cookie_headers: vec!["session=super-secret-value; Path=/; HttpOnly".into()],
            redirect_chain: Vec::new(),
            body: "<html><head><title>Security findings fixture page</title></head><body><main><h1>Page</h1><a href=\"http://example.com/ordinary-navigation\">HTTP link</a><script src=\"http://cdn.example.test/app.js?token=private\"></script></main></body></html>".into(),
            http_performance: test_http_performance(),
        };

        let report = analyze_page(fetch).await.unwrap();
        let transport = report.transport_security.as_ref().unwrap();
        assert!(transport.https);
        assert_eq!(
            transport.mixed_content_urls,
            ["http://cdn.example.test/app.js"]
        );
        assert_eq!(transport.cookies[0].name, "session");
        assert!(!transport.cookies[0].secure);
        assert!(transport.cookies[0].http_only);
        assert!(report
            .issues
            .iter()
            .any(|issue| issue.message.contains("mixed content")));
        let serialized = serde_json::to_string(&report).unwrap();
        assert!(!serialized.contains("super-secret-value"));
        assert!(!serialized.contains("token=private"));
        assert!(serialized.contains("ordinary-navigation"));
    }

    #[test]
    fn test_missing_h1_issue() {
        let html = "<html><body><h2>No H1 here</h2></body></html>";
        let (headings, issues) = parse_headings(html);
        assert_eq!(headings.h1_count, 0);
        assert!(issues.iter().any(|i| i.message.contains("No H1")));
    }

    #[test]
    fn test_multiple_h1_issue() {
        let html = "<html><body><h1>First H1</h1><h1>Second H1</h1></body></html>";
        let (headings, issues) = parse_headings(html);
        assert_eq!(headings.h1_count, 2);
        assert!(issues.iter().any(|i| i.message.contains("Multiple H1")));
    }

    #[test]
    fn builds_a_nested_heading_tree_without_losing_siblings() {
        let tree = build_heading_tree(&[
            (1, "Root".to_string()),
            (2, "First child".to_string()),
            (3, "Grandchild".to_string()),
            (2, "Second child".to_string()),
            (1, "Second root".to_string()),
        ]);

        assert_eq!(tree.len(), 2);
        assert_eq!(tree[0].children.len(), 2);
        assert_eq!(tree[0].children[0].children[0].text, "Grandchild");
        assert_eq!(tree[0].children[1].text, "Second child");
    }

    #[test]
    fn test_images_missing_alt() {
        let html = r#"<html><body><img src="pic1.jpg"><img src="pic2.jpg" alt="Description"></body></html>"#;
        let base = Url::parse("https://example.com").unwrap();
        let (images, issues) = parse_images(html, &base);

        assert_eq!(images.len(), 2);
        assert!(!images[0].has_alt);
        assert!(images[1].has_alt);
        assert!(issues.iter().any(|i| i.message.contains("missing 'alt'")));
    }

    #[test]
    fn empty_alt_is_decorative_without_requiring_aria_hidden_or_role() {
        let base = Url::parse("https://example.com").unwrap();
        let (images, issues) = parse_images(
            r#"<img src="decoration.png" alt=""><img src="missing.png">"#,
            &base,
        );
        assert!(images[0].has_alt);
        assert!(!images[1].has_alt);
        let missing = issues
            .iter()
            .find(|issue| issue.message.contains("missing 'alt'"))
            .unwrap();
        assert_eq!(missing.params.as_ref().unwrap().get("count").unwrap(), "1");
    }

    #[test]
    fn infers_intrinsic_dimensions_from_bounded_data_uris_without_network() {
        let mut png = vec![137, 80, 78, 71, 13, 10, 26, 10];
        png.resize(24, 0);
        png[16..20].copy_from_slice(&2u32.to_be_bytes());
        png[20..24].copy_from_slice(&3u32.to_be_bytes());
        let png_uri = format!("data:image/png;base64,{}", BASE64_STANDARD.encode(png));
        assert_eq!(intrinsic_data_uri_dimensions(&png_uri), Some((2, 3)));

        let svg_uri = "data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20120%2060%22%3E%3C/svg%3E";
        assert_eq!(intrinsic_data_uri_dimensions(svg_uri), Some((120, 60)));

        let percentage_svg = "data:image/svg+xml,%3Csvg%20width%3D%22100%25%22%20height%3D%2250%25%22%20viewBox%3D%220%200%2080%2040%22%3E%3C/svg%3E";
        assert_eq!(
            intrinsic_data_uri_dimensions(percentage_svg),
            Some((80, 40))
        );
    }

    #[test]
    fn parse_images_marks_intrinsic_dimensions_as_local_evidence() {
        let html = r#"<html><body><img src="data:image/gif;base64,R0lGODlhBAAFAAAA" alt="pixel"></body></html>"#;
        let base = Url::parse("https://example.com").unwrap();
        let (images, issues) = parse_images(html, &base);
        assert_eq!(images[0].width.as_deref(), Some("4"));
        assert_eq!(images[0].height.as_deref(), Some("5"));
        assert_eq!(
            images[0].dimensions_source.as_deref(),
            Some("intrinsic-data-uri")
        );
        assert!(!issues
            .iter()
            .any(|issue| issue.message.contains("missing explicit width/height")));
    }

    #[test]
    fn test_links_target_blank_security() {
        let html =
            r#"<html><body><a href="https://other.com" target="_blank">External</a></body></html>"#;
        let base = Url::parse("https://example.com").unwrap();
        let (links, issues) = parse_links(html, &base);

        assert_eq!(links.total_links, 1);
        assert_eq!(links.external_links, 1);
        assert!(issues
            .iter()
            .any(|i| i.message.contains("noopener noreferrer")));
    }
}
