use super::models::{
    CrawledCustomSearchResult, CustomSearchDefinition, XPathTerminal, XPathTextMatch,
    MAX_CUSTOM_SEARCH_CHARS_PER_RUN, MAX_MATCHES_PER_SEARCH, MAX_VALUE_CHARS,
};
use super::regex_extraction::extract_regex;
use super::xpath::xpath_to_css;
use super::xpath_predicate_helpers::normalize_xpath_space;
use scraper::{Html, Selector};

pub fn extract_custom_search_results(
    document: &Html,
    searches: &[CustomSearchDefinition],
) -> Vec<CrawledCustomSearchResult> {
    let mut remaining_chars = MAX_CUSTOM_SEARCH_CHARS_PER_RUN;
    extract_custom_search_results_with_budget(document, searches, &mut remaining_chars)
}

pub fn extract_custom_search_results_with_budget(
    document: &Html,
    searches: &[CustomSearchDefinition],
    remaining_chars: &mut usize,
) -> Vec<CrawledCustomSearchResult> {
    extract_custom_search_results_with_html(document, None, searches, remaining_chars)
}

pub fn extract_custom_search_results_with_html(
    document: &Html,
    source_html: Option<&str>,
    searches: &[CustomSearchDefinition],
    remaining_chars: &mut usize,
) -> Vec<CrawledCustomSearchResult> {
    searches
        .iter()
        .map(|search| extract_one(document, source_html, search, remaining_chars))
        .collect()
}

fn extract_one(
    document: &Html,
    source_html: Option<&str>,
    search: &CustomSearchDefinition,
    remaining_chars: &mut usize,
) -> CrawledCustomSearchResult {
    let mode = search.selector_type.trim().to_ascii_lowercase();
    let output = search.result_type.trim().to_ascii_lowercase();
    if mode == "regex" {
        return extract_regex(source_html, search, remaining_chars);
    }
    let xpath_selector = if mode == "xpath" {
        match xpath_to_css(search.query.trim()) {
            Ok(result) => Some(result),
            Err(error) => return failed_result(search, error),
        }
    } else {
        None
    };
    let selector = match Selector::parse(
        xpath_selector
            .as_ref()
            .map(|value| value.css.as_str())
            .unwrap_or_else(|| search.query.trim()),
    ) {
        Ok(selector) => selector,
        Err(error) => {
            return failed_result(search, format!("Nie można wykonać selektora: {error}."))
        }
    };

    let mut values = Vec::new();
    let mut truncated = false;
    for element in document.select(&selector) {
        if *remaining_chars == 0 {
            truncated = true;
            break;
        }
        if let Some(text_match) = xpath_selector
            .as_ref()
            .and_then(|value| value.text_match.as_ref())
        {
            let text = element.text().collect::<String>();
            let normalized = matches!(
                text_match,
                XPathTextMatch::ContainsNormalized(_) | XPathTextMatch::EqualsNormalized(_)
            );
            let candidate = if normalized {
                normalize_xpath_space(&text)
            } else {
                text.trim().to_owned()
            };
            let matches = match text_match {
                XPathTextMatch::Contains(value) | XPathTextMatch::ContainsNormalized(value) => {
                    candidate.contains(value)
                }
                XPathTextMatch::Equals(value) | XPathTextMatch::EqualsNormalized(value) => {
                    candidate == *value
                }
            };
            if !matches {
                continue;
            }
        }
        let value = match (
            xpath_selector.as_ref().map(|value| &value.terminal),
            output.as_str(),
        ) {
            (Some(XPathTerminal::Attribute(attribute)), _) => {
                element.value().attr(attribute).map(str::to_owned)
            }
            (_, "attribute") => search
                .attribute
                .as_deref()
                .and_then(|attribute| element.value().attr(attribute.trim()))
                .map(str::to_owned),
            (_, "html") => Some(element.inner_html()),
            _ => Some(element.text().collect::<String>().trim().to_owned()),
        };
        if let Some(value) = value.filter(|value| !value.trim().is_empty()) {
            if values.len() == MAX_MATCHES_PER_SEARCH {
                truncated = true;
                break;
            }
            let allowed_chars = MAX_VALUE_CHARS.min(*remaining_chars);
            let value_chars = value.chars().count();
            let bounded = value.chars().take(allowed_chars).collect::<String>();
            let stored_chars = bounded.chars().count();
            *remaining_chars -= stored_chars;
            truncated |= value_chars > stored_chars;
            values.push(bounded);
        }
    }

    CrawledCustomSearchResult {
        id: search.id.clone(),
        values,
        error: None,
        truncated,
    }
}

pub fn failed_result(search: &CustomSearchDefinition, error: String) -> CrawledCustomSearchResult {
    CrawledCustomSearchResult {
        id: search.id.clone(),
        values: Vec::new(),
        error: Some(error),
        truncated: false,
    }
}
