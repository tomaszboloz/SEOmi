use super::extraction::{
    extract_custom_search_results, extract_custom_search_results_with_html,
};
use super::tests_common::query;
use super::validation::validate_custom_searches;
use scraper::Html;

#[test]
fn text_contains_xpath_filters_elements_and_old_configs_default_empty() {
    let document = Html::parse_document(
        r#"<html><body><div>hello world</div><div>goodbye</div><p>Beta</p><p>Alpha</p><span>  Alpha   Beta </span></body></html>"#,
    );
    let xpath = query("xpath", "//div[contains(text(), 'hello')]", "text");
    let values = extract_custom_search_results(&document, &[xpath]);
    assert_eq!(values[0].values, ["hello world"]);
    let xpath = query("xpath", "//p[contains(., 'Bet')]", "text");
    let values = extract_custom_search_results(&document, &[xpath]);
    assert_eq!(values[0].values, ["Beta"]);
    let xpath = query("xpath", "//p[text()='Alpha']", "text");
    let values = extract_custom_search_results(&document, &[xpath]);
    assert_eq!(values[0].values, ["Alpha"]);
    let xpath = query("xpath", "//span[normalize-space(.)='Alpha Beta']", "text");
    let values = extract_custom_search_results(&document, &[xpath]);
    assert_eq!(values[0].values, ["Alpha   Beta"]);
    let xpath = query(
        "xpath",
        "//span[contains(normalize-space(.), 'Alpha Beta')]",
        "text",
    );
    let values = extract_custom_search_results(&document, &[xpath]);
    assert_eq!(values[0].values, ["Alpha   Beta"]);
    let config: serde_json::Value = serde_json::from_str(r#"{"selector_type":"css"}"#).unwrap();
    assert_eq!(config["selector_type"], "css");
}

#[test]
fn xpath_supports_attribute_prefix_absence_and_inequality_predicates() {
    let document = Html::parse_document(
        r#"<html><body>
            <a data-kind="product-1">One</a>
            <a data-kind="service">Two</a>
            <a>Three</a>
            <a data-kind="product-2" data-state="archived">Four</a>
        </body></html>"#,
    );

    let starts_with = query(
        "xpath",
        "//a[starts-with(@data-kind, 'product')]/text()",
        "text",
    );
    let values = extract_custom_search_results(&document, &[starts_with]);
    assert_eq!(values[0].values, ["One", "Four"]);

    let without_state = query("xpath", "//a[not(@data-state)]/text()", "text");
    let values = extract_custom_search_results(&document, &[without_state]);
    assert_eq!(values[0].values, ["One", "Two", "Three"]);

    let not_archived = query("xpath", "//a[@data-kind!='product-2']/text()", "text");
    let values = extract_custom_search_results(&document, &[not_archived]);
    assert_eq!(values[0].values, ["One", "Two"]);
}

#[test]
fn xpath_supports_last_and_position_predicates() {
    let document = Html::parse_document(
        r#"<html><body><ul><li>One</li><li>Two</li><li>Three</li></ul><ul><li>Four</li><li>Five</li></ul></body></html>"#,
    );

    let last = query("xpath", "//ul[1]/li[last()]/text()", "text");
    let values = extract_custom_search_results(&document, &[last]);
    assert_eq!(values[0].values, ["Three"]);

    let position = query("xpath", "//ul[2]/li[position() = 2]/text()", "text");
    let values = extract_custom_search_results(&document, &[position]);
    assert_eq!(values[0].values, ["Five"]);

    let last_position = query("xpath", "//ul[2]/li[position()=last()]/text()", "text");
    let values = extract_custom_search_results(&document, &[last_position]);
    assert_eq!(values[0].values, ["Five"]);
}

#[test]
fn regex_search_uses_first_capture_and_respects_shared_budget() {
    let document = Html::parse_document(
        r#"<html><body><p data-sku="SKU-123">One</p><p data-sku="SKU-456">Two</p></body></html>"#,
    );
    let regex = query("regex", r#"data-sku="([^"]+)""#, "text");
    let mut remaining = 7;
    let values = extract_custom_search_results_with_html(
        &document,
        Some(r#"<p data-sku="SKU-123"></p><p data-sku="SKU-456"></p>"#),
        &[regex],
        &mut remaining,
    );
    assert_eq!(values[0].values, ["SKU-123"]);
    assert!(values[0].truncated);
    assert_eq!(remaining, 0);
}

#[test]
fn regex_search_rejects_invalid_patterns_and_non_text_output() {
    let invalid = query("regex", "[", "text");
    assert!(validate_custom_searches(&[invalid]).is_err());
    let attribute = query("regex", "sku", "attribute");
    assert!(validate_custom_searches(&[attribute]).is_err());
}
