use super::super::{
    fetch_types::FetchedPageData,
    models::{CrawlConfig, CrawledPageIssue},
};

pub fn check_page_status_issues(
    page_data: &FetchedPageData,
    final_url: &str,
    current_url: &str,
    redirect_chain_len: usize,
    redirect_stopped_reason: Option<&String>,
    config: &CrawlConfig,
    issues: &mut Vec<CrawledPageIssue>,
) {
    let status = page_data.status;
    if status >= 400 {
        issues.push(CrawledPageIssue {
            severity: "Critical".into(),
            message: format!("HTTP error status {}", status),
        });
    }
    if redirect_chain_len > 0 {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: format!("Safely followed {redirect_chain_len} redirect(s)"),
        });
    }
    if let Some(reason) = redirect_stopped_reason {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: reason.clone(),
        });
    }
    // Rendered mode normally pairs the DOM with the HTTP response. Only a
    // bare snapshot lacks the status line and headers.
    let rendered_without_headers =
        config.crawl_mode == "browser-rendered" && !page_data.response_headers_available;
    let rendered_in_browser = page_data.rendered_diagnostics.is_some();
    if rendered_without_headers && final_url != current_url {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Browser navigation ended at a different URL; intermediate redirect hops are unavailable in rendered mode".into(),
        });
    } else if rendered_in_browser && redirect_chain_len == 0 && final_url != current_url {
        // The HTTP response was not redirected, so the page moved itself.
        // Status and headers still belong to the request.
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "The page navigated to a different URL in the browser; the HTTP status and response headers describe the requested URL".into(),
        });
    }
    if page_data.response_url_mismatch {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: "The rendered DOM ended at a different URL; HTTP status and headers are reported for the requested response and are not applied as final-document directives".into(),
        });
    }
    if let Some(reason) = &page_data.render_fallback {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!(
                "Browser rendering failed; the raw HTML response was analyzed instead: {reason}"
            ),
        });
    }
    if status == 0 && rendered_without_headers {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Browser did not expose the HTTP status for this rendered response".into(),
        });
    }
    if let Some((failed_resources, console_errors)) = &page_data.rendered_diagnostics {
        for resource in failed_resources.iter().take(10) {
            issues.push(CrawledPageIssue {
                severity: "Info".into(),
                message: format!("Browser failed to load a page resource: {resource}"),
            });
        }
        for error in console_errors.iter().take(10) {
            issues.push(CrawledPageIssue {
                severity: "Info".into(),
                message: format!("Browser console error: {error}"),
            });
        }
    }
    if !page_data.declared_html {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Non-HTML resource: HTML SEO checks were skipped".into(),
        });
    }
    if page_data.declared_html && page_data.body_truncated {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: "Response body exceeded the configured limit; HTML checks were skipped".into(),
        });
    }
    if page_data.declared_html && page_data.body_read_failed {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: "Response body could not be read completely; HTML checks were skipped".into(),
        });
    }
}
