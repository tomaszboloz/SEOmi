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
    if config.crawl_mode == "browser-rendered" && final_url != current_url {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Browser navigation ended at a different URL; intermediate redirect hops are unavailable in rendered mode".into(),
        });
    }
    if status == 0 && config.crawl_mode == "browser-rendered" {
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
    if page_data.body_truncated {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: "Response body exceeded the configured limit; HTML checks were skipped".into(),
        });
    }
    if page_data.body_read_failed {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: "Response body could not be read completely; HTML checks were skipped".into(),
        });
    }
}
