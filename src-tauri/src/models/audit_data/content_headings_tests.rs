use super::*;
use crate::models::audit_data::StructuredData;

#[test]
fn omitted_readability_method_defaults_to_unavailable() {
    let value = serde_json::json!({
        "word_count": 12,
        "reading_time_minutes": 1,
        "text_ratio_percent": 42.5,
        "top_keywords": []
    });
    let stats: ContentStats = serde_json::from_value(value).unwrap();

    assert_eq!(stats.readability_method, "unavailable");
}

#[test]
fn serde_defaults_restore_optional_content_fields_for_legacy_records() {
    let image: ImageData = serde_json::from_value(serde_json::json!({
        "src": "/image.webp",
        "alt": null,
        "width": null,
        "height": null,
        "loading": null,
        "srcset": null,
        "has_alt": false
    }))
    .unwrap();
    assert_eq!(image.format, None);
    assert_eq!(image.dimensions_source, None);

    let link: LinkData = serde_json::from_value(serde_json::json!({
        "href": "https://example.test",
        "text": "Example",
        "is_internal": false,
        "rel": null,
        "target": null
    }))
    .unwrap();
    assert!(!link.is_insecure);

    let keyword: KeywordStat = serde_json::from_value(serde_json::json!({
        "keyword": "seo",
        "count": 2
    }))
    .unwrap();
    assert_eq!(keyword.density_percent, 0.0);

    let structured: StructuredData = serde_json::from_value(serde_json::json!({
        "data_type": "Article",
        "format": "json-ld",
        "content": {}
    }))
    .unwrap();
    assert!(structured.validation_issues.is_empty());
}

#[test]
fn default_content_stats_and_readability_fallback_are_explicit() {
    assert_eq!(super::default_readability_method(), "unavailable");
    let stats = ContentStats::default();
    assert_eq!(stats.readability_method, "unavailable");
    assert_eq!(stats.complexity_label, "unavailable");
    assert!(stats.top_keywords.is_empty());
}
