use super::super::{
    mapping::{account_page, matching_streams, report_page, report_rows},
    models::Ga4Status,
    validation::{date_range, host_matches, property_name, site_scope},
};
use serde_json::json;

#[test]
fn validates_property_names_and_same_site_domain_scope() {
    assert_eq!(property_name(" properties/123 ").unwrap(), "properties/123");
    assert!(property_name("properties/abc").is_err());
    assert!(property_name("accounts/123").is_err());
    let scope = site_scope("sc-domain:Example.com").unwrap();
    assert!(host_matches(&scope, "www.example.com"));
    assert!(!host_matches(&scope, "example.com.evil.test"));
    let prefix = site_scope("https://www.example.com/blog/").unwrap();
    assert!(host_matches(&prefix, "WWW.EXAMPLE.COM"));
    assert!(!host_matches(&prefix, "example.com"));
}

#[test]
fn account_and_stream_mapping_keeps_domain_evidence_explicit() {
    let page = account_page(json!({
        "accountSummaries": [{"propertySummaries": [{"property": "properties/9", "displayName": "Main"}]}]
    }))
    .unwrap();
    assert_eq!(
        page.account_summaries[0].property_summaries[0].property,
        "properties/9"
    );
    let streams = super::super::mapping::stream_page(json!({
        "dataStreams": [
            {"name":"properties/9/dataStreams/0", "type":"ANDROID_APP_DATA_STREAM"},
            {"name":"properties/9/dataStreams/1", "type":"WEB_DATA_STREAM", "webStreamData":{"defaultUri":"https://example.com", "measurementId":"G-TEST"}}
        ]
    }))
    .unwrap();
    let matches = matching_streams(&streams, &site_scope("https://example.com").unwrap()).unwrap();
    assert_eq!(matches[0].host_name, "example.com");
    assert_eq!(matches[0].measurement_id.as_deref(), Some("G-TEST"));
}

#[test]
fn report_mapping_rejects_missing_metrics_and_cross_domain_rows() {
    let scope = site_scope("https://example.com").unwrap();
    let page = report_page(json!({"rowCount":1,"rows":[{"dimensionValues":[{"value":"/pricing?q=x"},{"value":"example.com"}],"metricValues":[{"value":"4"},{"value":"3"},{"value":"0"}]}]})).unwrap();
    let rows = report_rows(&page, &scope, "example.com").unwrap();
    assert_eq!(rows[0].key_events, 0.0);
    let mut invalid = page.clone();
    invalid.rows[0].metric_values[1].value = None;
    assert!(report_rows(&invalid, &scope, "example.com").is_err());
    let foreign = json!({"rows":[{"dimensionValues":[{"value":"/"},{"value":"evil.test"}],"metricValues":[{"value":"1"},{"value":"1"},{"value":"1"}]}]});
    let foreign = report_page(foreign).unwrap();
    assert!(report_rows(&foreign, &scope, "example.com").is_err());
    for value in ["-1", "NaN", "inf"] {
        let invalid = json!({"rows":[{"dimensionValues":[{"value":"/"},{"value":"example.com"}],"metricValues":[{"value":value},{"value":"1"},{"value":"1"}]}]});
        assert!(report_rows(&report_page(invalid).unwrap(), &scope, "example.com").is_err());
    }
    let wrong_schema = report_page(json!({
        "dimensionHeaders":[{"name":"country"}],
        "rows":[]
    }))
    .unwrap();
    assert!(report_rows(&wrong_schema, &scope, "example.com").is_err());
}

#[test]
fn date_range_is_strict_and_status_vocabulary_is_closed() {
    assert_eq!(
        date_range("2026-09-01", "2026-09-30").unwrap().0,
        "2026-09-01"
    );
    assert!(date_range("2026-10-01", "2026-09-30").is_err());
    assert_eq!(
        serde_json::to_string(&Ga4Status::Partial).unwrap(),
        "\"partial\""
    );
}
