use scraper::{Html, Selector};

use super::super::models::CrawledPageIssue;

pub struct PageTitleMetaOutcome {
    pub title: Option<String>,
    pub title_length: Option<usize>,
    pub meta_description: Option<String>,
    pub meta_description_length: Option<usize>,
}

pub fn extract_page_title_and_meta(
    document: &Html,
    is_html: bool,
    title_selector: &Selector,
    meta_desc_selector: &Selector,
    issues: &mut Vec<CrawledPageIssue>,
) -> PageTitleMetaOutcome {
    let titles = document
        .select(title_selector)
        .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string())
        .collect::<Vec<_>>();
    let title = titles.first().cloned();
    let title_length = title.as_deref().map(|v| v.chars().count());
    if is_html && (title.is_none() || title.as_ref().map(|t| t.is_empty()).unwrap_or(true)) {
        issues.push(CrawledPageIssue {
            severity: "Critical".into(),
            message: "Missing <title> tag".into(),
        });
    }
    if is_html && titles.len() > 1 {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("Multiple <title> tags found ({})", titles.len()),
        });
    }
    if is_html && title_length.is_some_and(|l| !(30..=60).contains(&l)) {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: format!(
                "Title length is {} characters; reference range is 30–60",
                title_length.unwrap_or_default()
            ),
        });
    }

    let meta_descriptions = document
        .select(meta_desc_selector)
        .filter_map(|el| el.value().attr("content"))
        .map(str::trim)
        .filter(|c| !c.is_empty())
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let meta_description = meta_descriptions.first().cloned();
    let meta_description_length = meta_description.as_deref().map(|v| v.chars().count());
    if is_html && meta_descriptions.is_empty() {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: "Missing meta description".into(),
        });
    }
    if is_html && meta_descriptions.len() > 1 {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!(
                "Multiple meta descriptions found ({})",
                meta_descriptions.len()
            ),
        });
    }
    if is_html && meta_description_length.is_some_and(|l| !(70..=160).contains(&l)) {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: format!(
                "Meta description length is {} characters; reference range is 70–160",
                meta_description_length.unwrap_or_default()
            ),
        });
    }

    PageTitleMetaOutcome {
        title,
        title_length,
        meta_description,
        meta_description_length,
    }
}
