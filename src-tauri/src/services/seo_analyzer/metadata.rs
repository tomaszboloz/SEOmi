use crate::models::audit_data::{Issue, IssueCategory, IssueSeverity, MetaTags};
use url::Url;

pub(super) fn audit_meta_tags(meta: &MetaTags, _base_url: &Url) -> Vec<Issue> {
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
