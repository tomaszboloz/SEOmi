use super::extraction::{
    extract_custom_search_results, extract_custom_search_results_with_budget,
};
use super::models::CustomSearchDefinition;
use super::tests_common::query;
use scraper::Html;

#[test]
fn css_search_returns_bounded_text_html_and_attribute_values() {
    let document = Html::parse_document(
        r#"<html><body><a class="product" href="/one"><b> First </b> result</a><a class="product" href="/two">Second</a></body></html>"#,
    );
    let text = extract_custom_search_results(&document, &[query("css", "a.product", "text")]);
    assert_eq!(text[0].values, ["First  result", "Second"]);
    let html = extract_custom_search_results(&document, &[query("css", "a.product", "html")]);
    assert!(html[0].values[0].contains("<b> First </b>"));
    let attr = extract_custom_search_results(&document, &[query("css", "a.product", "attribute")]);
    assert_eq!(attr[0].values, ["/one", "/two"]);
}

#[test]
fn xpath_supports_paths_text_attribute_predicates_and_contains() {
    let document = Html::parse_document(
        r#"<html><body><main><a class="product featured" href="/one">Alpha</a><a class="product" href="/two">Beta</a></main></body></html>"#,
    );
    let xpath = query(
        "xpath",
        "//main//a[contains(@class, 'product')]/text()",
        "text",
    );
    let values = extract_custom_search_results(&document, &[xpath]);
    assert_eq!(values[0].values, ["Alpha", "Beta"]);
    let xpath = query(
        "xpath",
        "//main/a[@class='product featured']/@href",
        "attribute",
    );
    let values = extract_custom_search_results(&document, &[xpath]);
    assert_eq!(values[0].values, ["/one"]);

    let xpath = query(
        "xpath",
        "//main/a[normalize-space(text())='Alpha']/text()",
        "text",
    );
    let values = extract_custom_search_results(&document, &[xpath]);
    assert_eq!(values[0].values, ["Alpha"]);
}

#[test]
fn extraction_obeys_the_shared_run_storage_budget() {
    let document = Html::parse_document("<html><body><h1>Alpha</h1><h2>Bravo</h2></body></html>");
    let searches = [
        query("css", "h1", "text"),
        CustomSearchDefinition {
            id: "second".into(),
            name: "Second".into(),
            selector_type: "css".into(),
            query: "h2".into(),
            result_type: "text".into(),
            attribute: None,
        },
    ];
    let mut remaining = 3;
    let results = extract_custom_search_results_with_budget(&document, &searches, &mut remaining);
    assert_eq!(results[0].values, ["Alp"]);
    assert!(results[0].truncated);
    assert!(results[1].values.is_empty());
    assert!(results[1].truncated);
    assert_eq!(remaining, 0);
}

#[test]
fn xpath_supports_top_level_and_for_css_compatible_predicates() {
    let document = Html::parse_document(
        r#"<html><body><a class="product" data-kind="featured">One</a><a class="product">Two</a><a data-kind="featured">Three</a></body></html>"#,
    );
    let search = query(
        "xpath",
        "//a[@class='product' and @data-kind='featured']/text()",
        "text",
    );
    let values = extract_custom_search_results(&document, &[search]);
    assert_eq!(values[0].values, ["One"]);

    let value_with_and = query(
        "xpath",
        "//a[contains(@class, 'product and featured')]/text()",
        "text",
    );
    let values = extract_custom_search_results(&document, &[value_with_and]);
    assert!(values[0].values.is_empty());
    assert!(values[0].error.is_none());
}
