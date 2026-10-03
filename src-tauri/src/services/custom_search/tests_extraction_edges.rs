use super::extract_custom_search_results;
use super::extraction::{extract_custom_search_results_with_budget, failed_result};
use super::regex_extraction::extract_regex;
use super::tests_common::query;
use scraper::Html;

#[test]
fn unicode_limits_count_characters_and_disclose_overflow() {
    let text = "ż".repeat(1001);
    let document = Html::parse_fragment(&format!("<p>{text}</p>"));
    let result = extract_custom_search_results(&document, &[query("css", "p", "text")]);
    assert_eq!(result[0].values, ["ż".repeat(1000)]);
    assert!(result[0].truncated);
    let mut budget = 3;
    let result = extract_custom_search_results_with_budget(
        &document,
        &[query("css", "p", "text")],
        &mut budget,
    );
    assert_eq!(result[0].values, ["żżż"]);
    assert_eq!(budget, 0);
    assert!(result[0].truncated);
}

#[test]
fn css_skips_missing_and_blank_values_and_caps_nonempty_matches() {
    let document = Html::parse_fragment(
        "<a></a><a href=' '></a><a href='1'></a><a href='2'></a><a href='3'></a><a href='4'></a><a href='5'></a><a href='6'></a>");
    let result = extract_custom_search_results(&document, &[query("css", "a", "attribute")]);
    assert_eq!(result[0].values, ["1", "2", "3", "4", "5"]);
    assert!(result[0].truncated);
    let no_matches = extract_custom_search_results(&document, &[query("css", "p", "text")]);
    assert!(no_matches[0].values.is_empty());
    assert!(!no_matches[0].truncated);
    for search in [query("css", "[", "text"), query("xpath", "//a[", "text")] {
        let results = extract_custom_search_results(&document, &[search]);
        assert!(results[0].error.is_some());
        assert!(results[0].values.is_empty());
        assert!(!results[0].truncated);
    }
}

#[test]
fn regex_public_entry_handles_missing_invalid_empty_and_uncaptured_matches() {
    let search = query("regex", "ż+", "text");
    let mut budget = 5;
    let result = extract_regex(None, &search, &mut budget);
    assert!(result.error.unwrap().contains("HTML"));
    assert_eq!(budget, 5);
    assert!(
        extract_regex(Some("x"), &query("regex", "[", "text"), &mut budget)
            .error
            .is_some()
    );
    let result = extract_regex(Some("żż żżżż"), &search, &mut budget);
    assert_eq!(result.values, ["żż", "żżż"]);
    assert!(result.truncated);
    assert_eq!(budget, 0);
    let result = extract_regex(Some("abcdef"), &query("regex", ".", "text"), &mut 100);
    assert_eq!(result.values, ["a", "b", "c", "d", "e"]);
    assert!(result.truncated);
    let result = extract_regex(Some("   "), &query("regex", r"\s*", "text"), &mut 100);
    assert!(result.values.is_empty());
    assert!(!result.truncated);
    let result = failed_result(&search, "local error".into());
    assert_eq!(result.id, search.id);
    assert_eq!(result.error.as_deref(), Some("local error"));
    assert!(result.values.is_empty());
    assert!(!result.truncated);
}
