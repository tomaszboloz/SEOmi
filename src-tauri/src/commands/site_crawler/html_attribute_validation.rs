use super::*;

const MAX_URI_REFERENCES_PER_PAGE: usize = 20_000;
const URI_ATTRIBUTES: [&str; 9] = [
    "href",
    "src",
    "action",
    "formaction",
    "poster",
    "cite",
    "data",
    "manifest",
    "xlink:href",
];

pub(in crate::commands::site_crawler) fn validate_element_attributes(
    document: &Html,
    decoded_html: &str,
    source_lower: &str,
    base_url: &url::Url,
    findings: &mut Vec<CrawledHtmlValidationFinding>,
    truncated: &mut bool,
) {
    let Ok(all_elements) = Selector::parse("*") else {
        return;
    };
    let mut seen_ids = HashSet::new();
    let mut id_tag_occurrences = HashMap::<(String, String), usize>::new();
    let mut uri_occurrences = HashMap::<(String, String, String), usize>::new();
    let mut checked_uris = 0usize;

    for element in document.select(&all_elements) {
        if let Some(id) = element
            .value()
            .attr("id")
            .map(str::trim)
            .filter(|id| !id.is_empty())
        {
            let element_name = element.value().name().to_string();
            let occurrence = id_tag_occurrences
                .entry((element_name.clone(), id.to_string()))
                .or_default();
            let tag_occurrence = *occurrence;
            *occurrence += 1;
            if !seen_ids.insert(id.to_string()) {
                let mut finding = CrawledHtmlValidationFinding {
                    code: "html-duplicate-id".into(),
                    severity: "Warning".into(),
                    message: "Wartość id nie jest unikalna w dokumencie.".into(),
                    element: Some(element.value().name().to_string()),
                    attribute: Some("id".into()),
                    value: Some(id.chars().take(240).collect()),
                    line: None,
                    column: None,
                    source_excerpt: None,
                };
                if let Some(offset) = locate_html_attribute(
                    decoded_html,
                    source_lower,
                    &element_name,
                    "id",
                    id,
                    tag_occurrence,
                ) {
                    set_html_finding_source(&mut finding, decoded_html, offset);
                }
                push_html_validation_finding(findings, truncated, finding);
            }
        }
        for (attribute, value) in element.value().attrs() {
            if !URI_ATTRIBUTES.contains(&attribute) || value.trim().is_empty() {
                continue;
            }
            checked_uris += 1;
            if checked_uris > MAX_URI_REFERENCES_PER_PAGE {
                *truncated = true;
                break;
            }
            let value = value.trim();
            if value.starts_with('#')
                || value.contains("{{")
                || value.contains("${")
                || value.starts_with("<%")
            {
                continue;
            }
            let has_valid_scheme = [
                "mailto:",
                "tel:",
                "javascript:",
                "data:",
                "blob:",
                "about:",
                "ftp:",
            ]
            .iter()
            .any(|scheme| value.to_ascii_lowercase().starts_with(scheme));
            let malformed = value.contains(char::is_whitespace)
                || !is_valid_percent_encoding(value)
                || (!has_valid_scheme && base_url.join(value).is_err());
            if malformed {
                let occurrence_key = (
                    element.value().name().to_string(),
                    attribute.to_string(),
                    value.to_string(),
                );
                let occurrence = uri_occurrences.entry(occurrence_key).or_default();
                let mut finding = CrawledHtmlValidationFinding {
                    code: "html-uri-invalid".into(),
                    severity: "Warning".into(),
                    message: "Wartość atrybutu URI ma niepoprawne kodowanie procentowe lub nie daje się rozwiązać względem URL strony.".into(),
                    element: Some(element.value().name().to_string()),
                    attribute: Some(attribute.to_string()),
                    value: Some(value.chars().take(240).collect()),
                    line: None,
                    column: None,
                    source_excerpt: None,
                };
                if let Some(offset) = locate_html_attribute(
                    decoded_html,
                    source_lower,
                    element.value().name(),
                    attribute,
                    value,
                    *occurrence,
                ) {
                    set_html_finding_source(&mut finding, decoded_html, offset);
                }
                push_html_validation_finding(findings, truncated, finding);
                *occurrence += 1;
            }
        }
        if checked_uris > MAX_URI_REFERENCES_PER_PAGE {
            break;
        }
    }
}
