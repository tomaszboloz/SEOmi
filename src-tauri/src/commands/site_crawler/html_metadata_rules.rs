use super::*;

pub(in crate::commands::site_crawler) fn check_html_language(
    document: &Html,
    decoded_html: &str,
    raw_lower: &str,
    findings: &mut Vec<CrawledHtmlValidationFinding>,
    truncated: &mut bool,
) {
    let html_selector = Selector::parse("html").expect("valid html selector");
    let html_element = document.select(&html_selector).next();
    let document_language = html_element
        .and_then(|el| el.value().attr("lang"))
        .map(str::trim)
        .filter(|v| !v.is_empty());
    if document_language.is_none() {
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-lang-missing".into(),
            severity: "Warning".into(),
            message: "Nie wykryto niepustego atrybutu lang na elemencie html; technologie asystujące mogą błędnie dobrać język wymowy.".into(),
            element: Some("html".into()),
            attribute: Some("lang".into()),
            value: None,
            line: None,
            column: None,
            source_excerpt: None,
        };
        if let Some(offset) = raw_lower.find("<html") {
            set_html_finding_source(&mut finding, decoded_html, offset);
        } else if !decoded_html.is_empty() {
            set_html_finding_source(&mut finding, decoded_html, 0);
        }
        push_html_validation_finding(findings, truncated, finding);
    }
}

pub(in crate::commands::site_crawler) fn check_html_meta_charset(
    document: &Html,
    decoded_html: &str,
    raw_lower: &str,
    http_charset: Option<&str>,
    findings: &mut Vec<CrawledHtmlValidationFinding>,
    truncated: &mut bool,
) {
    if http_charset.is_none() && !document_declares_meta_charset(document) {
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-meta-charset-missing".into(),
            severity: "Warning".into(),
            message: "Nie wykryto deklaracji charsetu w dokumencie HTML ani w nagłówku HTTP; dekodowanie może zależeć od heurystyki.".into(),
            element: Some("meta".into()),
            attribute: Some("charset".into()),
            value: None,
            line: None,
            column: None,
            source_excerpt: None,
        };
        if let Some(offset) = raw_lower.find("<head").or_else(|| raw_lower.find("<html")) {
            set_html_finding_source(&mut finding, decoded_html, offset);
        } else if !decoded_html.is_empty() {
            set_html_finding_source(&mut finding, decoded_html, 0);
        }
        push_html_validation_finding(findings, truncated, finding);
    }
}
