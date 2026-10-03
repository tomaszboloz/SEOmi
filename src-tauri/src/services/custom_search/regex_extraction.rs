use super::extraction::failed_result;
use super::models::{
    CrawledCustomSearchResult, CustomSearchDefinition, MAX_MATCHES_PER_SEARCH, MAX_VALUE_CHARS,
};
use regex::Regex;

pub fn extract_regex(
    source_html: Option<&str>,
    search: &CustomSearchDefinition,
    remaining_chars: &mut usize,
) -> CrawledCustomSearchResult {
    let Some(source_html) = source_html else {
        return failed_result(
            search,
            "Wynik regex wymaga źródłowego HTML tego dokumentu.".into(),
        );
    };
    let regex = match Regex::new(search.query.trim()) {
        Ok(regex) => regex,
        Err(error) => {
            return failed_result(search, format!("Nie można wykonać regex: {error}."))
        }
    };
    let mut values = Vec::new();
    let mut truncated = false;
    for captures in regex.captures_iter(source_html) {
        if values.len() == MAX_MATCHES_PER_SEARCH || *remaining_chars == 0 {
            truncated = true;
            break;
        }
        let value = captures
            .get(1)
            .or_else(|| captures.get(0))
            .map(|match_| match_.as_str().to_owned());
        let Some(value) = value.filter(|val| !val.trim().is_empty()) else {
            continue;
        };
        let allowed_chars = MAX_VALUE_CHARS.min(*remaining_chars);
        let value_chars = value.chars().count();
        let bounded = value.chars().take(allowed_chars).collect::<String>();
        let stored_chars = bounded.chars().count();
        *remaining_chars -= stored_chars;
        truncated |= value_chars > stored_chars;
        values.push(bounded);
    }
    CrawledCustomSearchResult {
        id: search.id.clone(),
        values,
        error: None,
        truncated,
    }
}
