use super::*;

pub(super) fn document_declares_meta_charset(document: &Html) -> bool {
    let Ok(meta_selector) = Selector::parse("meta") else {
        return false;
    };
    document.select(&meta_selector).any(|meta| {
        if meta
            .value()
            .attr("charset")
            .is_some_and(|v| !v.trim().is_empty())
        {
            return true;
        }
        meta.value()
            .attr("http-equiv")
            .is_some_and(|v| v.trim().eq_ignore_ascii_case("content-type"))
            && meta.value().attr("content").is_some_and(|v| {
                v.to_ascii_lowercase()
                    .split(';')
                    .any(|part| part.trim_start().starts_with("charset="))
            })
    })
}

pub(super) fn check_html_doctype(
    decoded_html: &str,
    raw_lower: &str,
    findings: &mut Vec<CrawledHtmlValidationFinding>,
    truncated: &mut bool,
) {
    let doctype_declarations = raw_lower
        .match_indices("<!doctype")
        .map(|(offset, _)| {
            let end = raw_lower[offset..]
                .find('>')
                .map_or(raw_lower.len(), |r| offset + r + 1);
            (offset, end)
        })
        .collect::<Vec<_>>();
    let is_html_doctype = |(offset, end): &(usize, usize)| {
        let decl = raw_lower[offset + "<!doctype".len()..*end].trim_start();
        decl.strip_prefix("html").is_some_and(|t| {
            t.is_empty() || t.starts_with('>') || t.starts_with(char::is_whitespace)
        })
    };
    if doctype_declarations.is_empty() {
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-doctype-missing".into(),
            severity: "Warning".into(),
            message: "Nie wykryto deklaracji <!doctype html>; przeglądarka może użyć trybu quirks."
                .into(),
            element: Some("html".into()),
            attribute: None,
            value: None,
            line: None,
            column: None,
            source_excerpt: None,
        };
        if !decoded_html.is_empty() {
            set_html_finding_source(&mut finding, decoded_html, 0);
        }
        push_html_validation_finding(findings, truncated, finding);
    } else if !doctype_declarations.iter().any(is_html_doctype) {
        let (offset, end) = doctype_declarations[0];
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-doctype-invalid".into(),
            severity: "Warning".into(),
            message: "Wykryta deklaracja doctype nie wskazuje dokumentu HTML5.".into(),
            element: Some("!doctype".into()),
            attribute: None,
            value: Some(decoded_html[offset..end].chars().take(240).collect()),
            line: None,
            column: None,
            source_excerpt: None,
        };
        set_html_finding_source(&mut finding, decoded_html, offset);
        push_html_validation_finding(findings, truncated, finding);
    }
    if doctype_declarations.len() > 1 {
        let (offset, end) = doctype_declarations[1];
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-doctype-duplicate".into(),
            severity: "Warning".into(),
            message: "Dokument zawiera więcej niż jedną deklarację doctype.".into(),
            element: Some("!doctype".into()),
            attribute: None,
            value: Some(decoded_html[offset..end].chars().take(240).collect()),
            line: None,
            column: None,
            source_excerpt: None,
        };
        set_html_finding_source(&mut finding, decoded_html, offset);
        push_html_validation_finding(findings, truncated, finding);
    }
}

#[path = "html_metadata_rules.rs"]
mod metadata;
pub(super) use metadata::*;
