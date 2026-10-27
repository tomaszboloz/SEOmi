use super::super::{
    mapping::{account_page, matching_streams, report_page, report_rows},
    models::{StreamPage, WebDataStream, WebStreamData},
    validation::site_scope,
};
use serde_json::json;

#[test]
fn report_rows_dimension_count_mismatch() {
    let scope = site_scope("https://example.com").unwrap();
    let page = report_page(json!({
        "rows": [{
            "dimensionValues": [{"value": "/"}],
            "metricValues": [{"value": "1"}, {"value": "1"}, {"value": "1"}]
        }]
    }))
    .unwrap();
    assert_eq!(
        report_rows(&page, &scope, "example.com").unwrap_err(),
        "Google Analytics returned an invalid report row."
    );
    let page3 = report_page(json!({
        "rows": [{
            "dimensionValues": [{"value": "/"}, {"value": "example.com"}, {"value": "extra"}],
            "metricValues": [{"value": "1"}, {"value": "1"}, {"value": "1"}]
        }]
    }))
    .unwrap();
    assert_eq!(
        report_rows(&page3, &scope, "example.com").unwrap_err(),
        "Google Analytics returned an invalid report row."
    );
}

#[test]
fn report_rows_metric_count_mismatch_and_key_events_error() {
    let scope = site_scope("https://example.com").unwrap();
    let page = report_page(json!({
        "rows": [{
            "dimensionValues": [{"value": "/"}, {"value": "example.com"}],
            "metricValues": [{"value": "1"}, {"value": "1"}]
        }]
    }))
    .unwrap();
    assert_eq!(
        report_rows(&page, &scope, "example.com").unwrap_err(),
        "Google Analytics returned an invalid report row."
    );
    let page_metric = report_page(json!({
        "rows": [{
            "dimensionValues": [{"value": "/"}, {"value": "example.com"}],
            "metricValues": [{"value": "1"}, {"value": "1"}, {"value": "invalid-float"}]
        }]
    }))
    .unwrap();
    assert!(report_rows(&page_metric, &scope, "example.com").is_err());
}

#[test]
fn report_rows_host_normalization_and_missing_host() {
    let scope = site_scope("https://example.com").unwrap();
    let page_none = report_page(json!({
        "rows": [{
            "dimensionValues": [{"value": "/"}, {"value": null}],
            "metricValues": [{"value": "1"}, {"value": "1"}, {"value": "1"}]
        }]
    }))
    .unwrap();
    assert_eq!(
        report_rows(&page_none, &scope, "example.com").unwrap_err(),
        "Google Analytics returned traffic for an unrelated host."
    );
    let page_invalid = report_page(json!({
        "rows": [{
            "dimensionValues": [{"value": "/"}, {"value": ":::invalid:::"}],
            "metricValues": [{"value": "1"}, {"value": "1"}, {"value": "1"}]
        }]
    }))
    .unwrap();
    assert_eq!(
        report_rows(&page_invalid, &scope, "example.com").unwrap_err(),
        "Google Analytics returned traffic for an unrelated host."
    );
}

#[test]
fn account_page_invalid_property_name_format() {
    let bad_account = json!({
        "accountSummaries": [{
            "propertySummaries": [{"property": "bad_property_name"}]
        }]
    });
    assert_eq!(
        account_page(bad_account).unwrap_err(),
        "Google Analytics returned an invalid property name."
    );
}

#[test]
fn validate_headers_matching_and_empty_rows_succeeds() {
    let scope = site_scope("https://example.com").unwrap();
    let page = report_page(json!({
        "dimensionHeaders": [
            {"name": "landingPagePlusQueryString"},
            {"name": "hostName"}
        ],
        "metricHeaders": [
            {"name": "sessions"},
            {"name": "engagedSessions"},
            {"name": "keyEvents"}
        ],
        "rows": []
    }))
    .unwrap();
    let rows = report_rows(&page, &scope, "example.com").unwrap();
    assert!(rows.is_empty());
}

#[test]
fn matching_stream_missing_fields_edge_cases() {
    let scope = site_scope("https://example.com").unwrap();
    let page = StreamPage {
        data_streams: vec![
            WebDataStream {
                name: Some("s1".into()),
                display_name: None,
                stream_type: Some("WEB_DATA_STREAM".into()),
                web_stream_data: Some(WebStreamData {
                    measurement_id: None,
                    default_uri: None,
                }),
            },
            WebDataStream {
                name: Some("s2".into()),
                display_name: None,
                stream_type: Some("WEB_DATA_STREAM".into()),
                web_stream_data: None,
            },
        ],
        next_page_token: None,
    };
    let matches = matching_streams(&page, &scope).unwrap();
    assert!(matches.is_empty());
}
