use super::super::{
    mapping::{account_page, matching_streams, report_page, report_rows, stream_page},
    models::{StreamPage, WebDataStream, WebStreamData},
    validation::site_scope,
};
use serde_json::json;

#[test]
fn mapping_errors_for_invalid_json_types() {
    assert!(account_page(json!("not-an-object")).is_err());
    assert!(stream_page(json!("not-an-object")).is_err());
    assert!(report_page(json!("not-an-object")).is_err());
}

#[test]
fn matching_streams_edges_and_fallbacks() {
    let scope = site_scope("https://example.com").unwrap();
    let stream_no_web_data = WebDataStream {
        name: Some("".into()),
        display_name: None,
        stream_type: Some("WEB_DATA_STREAM".into()),
        web_stream_data: None,
    };
    let stream_no_uri = WebDataStream {
        name: Some("   ".into()),
        display_name: None,
        stream_type: Some("WEB_DATA_STREAM".into()),
        web_stream_data: Some(WebStreamData {
            measurement_id: None,
            default_uri: None,
        }),
    };
    let stream_invalid_uri = WebDataStream {
        name: None,
        display_name: None,
        stream_type: Some("WEB_DATA_STREAM".into()),
        web_stream_data: Some(WebStreamData {
            measurement_id: None,
            default_uri: Some("http://invalid uri".into()),
        }),
    };
    let stream_mismatch_host = WebDataStream {
        name: None,
        display_name: None,
        stream_type: Some("WEB_DATA_STREAM".into()),
        web_stream_data: Some(WebStreamData {
            measurement_id: None,
            default_uri: Some("https://other.test".into()),
        }),
    };
    let stream_valid_fallback_name = WebDataStream {
        name: Some("  \t ".into()),
        display_name: Some("Display".into()),
        stream_type: Some("WEB_DATA_STREAM".into()),
        web_stream_data: Some(WebStreamData {
            measurement_id: Some("G-123".into()),
            default_uri: Some("https://example.com/stream".into()),
        }),
    };
    let page = StreamPage {
        data_streams: vec![
            stream_no_web_data,
            stream_no_uri,
            stream_mismatch_host,
            stream_valid_fallback_name,
        ],
        next_page_token: None,
    };
    let result = matching_streams(&page, &scope).unwrap();
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].name, "web stream");
    assert_eq!(result[0].default_uri, "https://example.com/stream");

    let invalid_page = StreamPage {
        data_streams: vec![stream_invalid_uri],
        next_page_token: None,
    };
    assert!(matching_streams(&invalid_page, &scope).is_err());
}

#[test]
fn report_rows_edges_and_missing_values() {
    let scope = site_scope("https://example.com").unwrap();
    let invalid_metric_headers = report_page(json!({
        "metricHeaders": [{"name": "invalidMetric"}],
        "rows": []
    }))
    .unwrap();
    assert!(report_rows(&invalid_metric_headers, &scope, "example.com").is_err());

    let missing_landing = report_page(json!({
        "rows": [{
            "dimensionValues": [{"value": null}, {"value": "example.com"}],
            "metricValues": [{"value": "1"}, {"value": "1"}, {"value": "1"}]
        }]
    }))
    .unwrap();
    assert!(report_rows(&missing_landing, &scope, "example.com").is_err());

    let wrong_host = report_page(json!({
        "rows": [{
            "dimensionValues": [{"value": "/"}, {"value": "different.com"}],
            "metricValues": [{"value": "1"}, {"value": "1"}, {"value": "1"}]
        }]
    }))
    .unwrap();
    assert!(report_rows(&wrong_host, &scope, "example.com").is_err());
}
