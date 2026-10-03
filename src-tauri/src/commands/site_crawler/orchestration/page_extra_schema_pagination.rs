use scraper::{Html, Selector};
use url::Url;

use super::super::{
    models::{
        CrawledHreflang, CrawledPageIssue, CrawledPaginationLink, CrawledSchemaFinding,
        CrawledSchemaReference,
    },
    pagination::crawl_pagination_links,
    schema::inspect_page_schema,
};

pub struct PageExtraSchemaPaginationOutcome {
    pub hreflangs: Vec<CrawledHreflang>,
    pub amp_url: Option<String>,
    pub pagination_links: Vec<CrawledPaginationLink>,
    pub pagination_declaration_count: usize,
    pub pagination_invalid_declaration_count: usize,
    pub pagination_next: Option<String>,
    pub pagination_prev: Option<String>,
    pub schema_types: Vec<String>,
    pub schema_syntax_errors: usize,
    pub schema_validation_findings: Vec<CrawledSchemaFinding>,
    pub schema_references: Vec<CrawledSchemaReference>,
    pub schema_validation_truncated: bool,
}

pub fn extract_page_schema_and_pagination(
    document: &Html,
    final_base: &Url,
    is_html: bool,
    canonical_selector: &Selector,
    hreflang_selector: &Selector,
    issues: &mut Vec<CrawledPageIssue>,
) -> PageExtraSchemaPaginationOutcome {
    let empty_document = (!is_html).then(|| Html::parse_document(""));
    let document = empty_document.as_ref().unwrap_or(document);
    let mut hreflangs = Vec::new();
    for element in document.select(hreflang_selector) {
        let Some(language) = element
            .value()
            .attr("hreflang")
            .map(str::trim)
            .filter(|v| !v.is_empty())
        else {
            continue;
        };
        let Some(href) = element.value().attr("href") else {
            continue;
        };
        if let Ok(target) = final_base.join(href) {
            hreflangs.push(CrawledHreflang {
                language: language.to_string(),
                target_url: target.to_string(),
                target_http_status: None,
                target_checked_in_run: false,
                reciprocal_in_run: None,
                target_canonical_alignment: None,
            });
        }
    }
    hreflangs.sort_by(|l, r| {
        l.language
            .cmp(&r.language)
            .then(l.target_url.cmp(&r.target_url))
    });

    let amp_url = document
        .select(canonical_selector)
        .find_map(|element| {
            let rel = element.value().attr("rel")?;
            rel.split_ascii_whitespace()
                .any(|v| v.eq_ignore_ascii_case("amphtml"))
                .then(|| element.value().attr("href"))
                .flatten()
        })
        .and_then(|href| final_base.join(href).ok())
        .map(|u| u.to_string());

    let (pagination_links, pagination_declaration_count, pagination_invalid_declaration_count) =
        crawl_pagination_links(document, final_base);
    let pagination_next = pagination_links
        .iter()
        .find(|l| l.relation == "next")
        .map(|l| l.target_url.clone());
    let pagination_prev = pagination_links
        .iter()
        .find(|l| l.relation == "prev")
        .map(|l| l.target_url.clone());

    let (
        schema_types,
        schema_syntax_errors,
        schema_validation_findings,
        schema_references,
        schema_validation_truncated,
    ) = if is_html {
        inspect_page_schema(document)
    } else {
        (Vec::new(), 0, Vec::new(), Vec::new(), false)
    };
    if schema_syntax_errors > 0 {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("{schema_syntax_errors} invalid JSON-LD block(s)"),
        });
    }

    PageExtraSchemaPaginationOutcome {
        hreflangs,
        amp_url,
        pagination_links,
        pagination_declaration_count,
        pagination_invalid_declaration_count,
        pagination_next,
        pagination_prev,
        schema_types,
        schema_syntax_errors,
        schema_validation_findings,
        schema_references,
        schema_validation_truncated,
    }
}
