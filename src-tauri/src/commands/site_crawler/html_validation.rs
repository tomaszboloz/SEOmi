use super::*;

pub(super) fn validate_crawl_html_with_charset(
    document: &Html,
    decoded_html: &str,
    base_url: &url::Url,
    http_charset: Option<&str>,
) -> (Vec<CrawledHtmlValidationFinding>, bool) {
    let mut findings = Vec::new();
    let mut truncated = false;
    let raw_lower = decoded_html.to_ascii_lowercase();

    check_html_doctype(decoded_html, &raw_lower, &mut findings, &mut truncated);
    check_html_language(
        document,
        decoded_html,
        &raw_lower,
        &mut findings,
        &mut truncated,
    );
    check_html_meta_charset(
        document,
        decoded_html,
        &raw_lower,
        http_charset,
        &mut findings,
        &mut truncated,
    );
    validate_element_attributes(
        document,
        decoded_html,
        &raw_lower,
        base_url,
        &mut findings,
        &mut truncated,
    );

    (findings, truncated)
}

#[path = "html_attribute_validation.rs"]
mod attributes;
pub(super) use attributes::*;
