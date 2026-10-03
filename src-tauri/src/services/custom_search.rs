pub mod extraction;
pub mod models;
pub mod regex_extraction;
pub mod validation;
pub mod xpath;
pub mod xpath_predicate_helpers;
pub mod xpath_predicates;
pub mod xpath_text_predicates;

#[cfg(test)]
mod tests_1;
#[cfg(test)]
mod tests_2;
#[cfg(test)]
mod tests_common;
#[cfg(test)]
mod tests_extraction_edges;
#[cfg(test)]
mod tests_validation_edges;
#[cfg(test)]
mod tests_xpath_edges;

pub use extraction::{
    extract_custom_search_results, extract_custom_search_results_with_budget,
    extract_custom_search_results_with_html,
};
pub use models::{
    CrawledCustomSearchResult, CustomSearchDefinition, MAX_CUSTOM_SEARCHES,
    MAX_CUSTOM_SEARCH_CHARS_PER_RUN,
};
pub use validation::validate_custom_searches;
