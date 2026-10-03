use super::*;

#[test]
fn records_jsonld_syntax_and_supported_schema_profile_findings() {
    let parsed = parse_html(
        r#"<html><head>
          <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","description":"A sample product"}</script>
          <script type="application/ld+json">{"@type":</script>
        </head></html>"#,
        "https://example.com",
    )
    .unwrap();
    assert_eq!(parsed.structured_data.len(), 2);
    assert!(parsed.structured_data[0]
        .validation_issues
        .iter()
        .any(|issue| issue.code == "product-name-missing"));
    assert_eq!(parsed.structured_data[1].data_type, "Invalid JSON-LD block");
    assert!(parsed.structured_data[1]
        .validation_issues
        .iter()
        .any(|issue| issue.code == "jsonld-syntax-invalid"));
}

#[test]
fn reports_microdata_without_itemtype_instead_of_silently_dropping_it() {
    let parsed = parse_html(
        "<html><body><div itemscope><span itemprop=\"name\">Item</span></div></body></html>",
        "https://example.com",
    )
    .unwrap();
    let item = parsed
        .structured_data
        .iter()
        .find(|data| data.format == "Microdata")
        .unwrap();
    assert!(item
        .validation_issues
        .iter()
        .any(|issue| issue.code == "microdata-itemtype-missing"));
}

#[test]
fn test_rdfa_extraction_preserves_declared_attributes() {
    let parsed = parse_html(
        "<html><body vocab=\"https://schema.org/\"><article typeof=\"Article\" about=\"https://example.com/post\"><span property=\"headline\">Title</span></article></body></html>",
        "https://example.com",
    )
    .unwrap();
    let article = parsed
        .structured_data
        .iter()
        .find(|item| item.format == "RDFa" && item.data_type == "Article")
        .expect("declared RDFa typeof should be extracted");

    assert_eq!(article.content["about"], "https://example.com/post");
    assert!(parsed
        .structured_data
        .iter()
        .any(|item| item.format == "RDFa" && item.data_type == "property: headline"));
}

#[test]
fn preserves_microdata_references_and_rdfa_relation_attributes_for_validation() {
    let parsed = parse_html(
        r#"<html><body>
          <div itemscope itemtype="https://schema.org/Product" itemid="https://example.com/product/1" itemref="product-details">
            <span itemprop="name">Example</span>
          </div>
          <div vocab="https://schema.org/" typeof="Product" rel="related" rev="isPartOf" datatype="https://schema.org/Text" content="Example" prefix="schema: https://schema.org/"></div>
          <span id="product-details" itemprop="description">Description</span>
        </body></html>"#,
        "https://example.com",
    )
    .unwrap();
    let microdata = parsed
        .structured_data
        .iter()
        .find(|item| item.format == "Microdata")
        .expect("microdata should be extracted");
    assert_eq!(microdata.content["itemid"], "https://example.com/product/1");
    assert_eq!(microdata.content["itemref"][0], "product-details");
    let rdfa = parsed
        .structured_data
        .iter()
        .find(|item| item.format == "RDFa" && item.data_type == "Product")
        .expect("RDFa should be extracted");
    assert_eq!(rdfa.content["rel"], "related");
    assert_eq!(rdfa.content["rev"], "isPartOf");
    assert_eq!(rdfa.content["prefix"], "schema: https://schema.org/");
}

#[test]
fn test_content_statistics() {
    let parsed = parse_html(SAMPLE_HTML, "https://example.com").unwrap();
    assert!(parsed.content_stats.word_count > 0);
    assert!(parsed.content_stats.text_ratio_percent > 0.0);
    assert!(parsed
        .content_stats
        .body_text
        .contains("comprehensive SEO analysis"));
    assert!(parsed.content_stats.sentence_count > 0);
    assert!(parsed.content_stats.average_words_per_sentence > 0.0);
    assert!(parsed.content_stats.average_characters_per_word > 0.0);
    assert!(parsed.content_stats.complexity_score > 0);
    assert_ne!(parsed.content_stats.complexity_label, "unavailable");
    assert!(parsed.content_stats.readability_ease_score > 0.0);
    assert!(parsed.content_stats.readability_grade >= 0.0);
    assert_eq!(parsed.content_stats.readability_method, "flesch-en");
    assert_ne!(parsed.content_stats.readability_label, "unavailable");
    assert!(parsed
        .content_stats
        .top_keywords
        .iter()
        .all(|keyword| keyword.density_percent > 0.0));
}

#[test]
fn polish_function_words_are_filtered_and_grade_is_bounded() {
    let parsed = parse_html(
        r#"<html lang="pl"><body><p>Więcej czytaj twojej audyt audyt strony.</p></body></html>"#,
        "https://example.com",
    )
    .unwrap();
    assert!(parsed.content_stats.readability_grade <= 100.0);
    for keyword in &parsed.content_stats.top_keywords {
        assert!(!["więcej", "czytaj", "twojej"].contains(&keyword.keyword.as_str()));
    }
}
