use super::*;

#[test]
fn jsonld_keeps_parse_errors_and_supported_types_without_losing_format_evidence() {
    let doc = Html::parse_document(
        r#"<script type="application/ld+json">{"@type":"Article"}</script><script type="application/ld+json">{invalid}</script>"#,
    );
    let data = extract_jsonld(&doc);
    assert_eq!(data.len(), 2);
    assert_eq!(data[0].data_type, "Article");
    assert_eq!(data[0].format, "JSON-LD");
    assert_eq!(data[1].data_type, "Invalid JSON-LD block");
    assert_eq!(data[1].validation_issues[0].code, "jsonld-syntax-invalid");
    assert!(data[1].content["parse_error"].is_string());
}

#[test]
fn microdata_records_missing_type_and_explicit_reference_tokens() {
    let doc = Html::parse_document("<div itemscope itemid='id' itemref='one two'><span itemprop='name headline'></span></div><div itemscope itemtype='https://schema.org/Article'></div>");
    let data = extract_microdata(&doc);
    assert_eq!(data.len(), 2);
    assert_eq!(data[0].data_type, "Unknown Microdata item");
    assert_eq!(
        data[0].content["itemref"],
        serde_json::json!(["one", "two"])
    );
    assert_eq!(
        data[0].content["itemprops"],
        serde_json::json!(["name", "headline"])
    );
    assert_eq!(data[1].data_type, "https://schema.org/Article");
}

#[test]
fn rdfa_requires_anchor_and_preserves_all_declared_relation_fields() {
    let doc = Html::parse_document("<meta content='plain'><link rel='icon' href='/icon'><div typeof='Article' vocab='https://schema.org/' about='/article' resource='/id' rel='author' rev='owner' datatype='text' content='value' prefix='schema: https://schema.org/' inlist></div><span property='name'></span><div vocab='https://schema.org/'></div>");
    let data = extract_rdfa(&doc);
    assert_eq!(data.len(), 3);
    assert_eq!(data[0].data_type, "Article");
    for key in [
        "typeof", "vocab", "about", "resource", "rel", "rev", "datatype", "content", "prefix",
    ] {
        assert!(data[0].content[key].is_string(), "{key}");
    }
    assert_eq!(data[0].content["inlist"], true);
    assert_eq!(data[1].data_type, "property: name");
    assert_eq!(data[2].data_type, "vocab: https://schema.org/");
    let combined = extract_structured_data(&doc);
    assert_eq!(combined.len(), data.len());
    assert!(combined.iter().all(|item| item.format == "RDFa"));
}
