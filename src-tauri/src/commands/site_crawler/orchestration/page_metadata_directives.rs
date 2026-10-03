use scraper::{Html, Selector};
use url::Url;

use super::super::{
    client_redirects::parse_client_redirect,
    fetch_types::FetchedPageData,
    js_redirects::extract_javascript_redirects,
    models::{CrawledClientRedirect, CrawledPageIssue},
};

pub struct PageDirectivesOutcome {
    pub client_redirects: Vec<CrawledClientRedirect>,
    pub meta_robots: Option<String>,
    pub meta_noindex: bool,
    pub header_noindex: bool,
    pub meta_nofollow: bool,
    pub header_nofollow: bool,
}

pub fn extract_page_directives(
    document: &Html,
    final_base: &Url,
    page_data: &FetchedPageData,
    robots_selector: &Selector,
    meta_refresh_selector: &Selector,
    issues: &mut Vec<CrawledPageIssue>,
) -> PageDirectivesOutcome {
    let meta_robots = document
        .select(robots_selector)
        .filter_map(|el| el.value().attr("content"))
        .map(str::trim)
        .filter(|c| !c.is_empty())
        .map(str::to_owned)
        .next();

    let mut client_redirects = document
        .select(meta_refresh_selector)
        .filter_map(|element| {
            let equiv = element.value().attr("http-equiv")?;
            equiv
                .eq_ignore_ascii_case("refresh")
                .then(|| element.value().attr("content"))
                .flatten()
        })
        .map(|decl| parse_client_redirect("meta-refresh", decl, final_base))
        .collect::<Vec<_>>();
    if let Some(declaration) = &page_data.http_refresh {
        client_redirects.push(parse_client_redirect(
            "http-refresh",
            declaration,
            final_base,
        ));
    }
    client_redirects.extend(extract_javascript_redirects(document, final_base));
    if !client_redirects.is_empty() {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!(
                "Client-side refresh redirect detected ({} declaration(s))",
                client_redirects.len()
            ),
        });
    }

    let meta_noindex = meta_robots
        .as_deref()
        .is_some_and(|v| v.to_ascii_lowercase().contains("noindex"));
    let header_noindex = page_data
        .x_robots_tag
        .as_deref()
        .is_some_and(|v| v.to_ascii_lowercase().contains("noindex"));
    let meta_nofollow = meta_robots
        .as_deref()
        .is_some_and(|v| v.to_ascii_lowercase().contains("nofollow"));
    let header_nofollow = page_data
        .x_robots_tag
        .as_deref()
        .is_some_and(|v| v.to_ascii_lowercase().contains("nofollow"));

    if meta_noindex {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Page declares noindex in meta robots".into(),
        });
    }
    if header_noindex {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Response declares noindex in X-Robots-Tag".into(),
        });
    }
    if meta_nofollow {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Page declares nofollow in meta robots".into(),
        });
    }
    if header_nofollow {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Response declares nofollow in X-Robots-Tag".into(),
        });
    }

    PageDirectivesOutcome {
        client_redirects,
        meta_robots,
        meta_noindex,
        header_noindex,
        meta_nofollow,
        header_nofollow,
    }
}
