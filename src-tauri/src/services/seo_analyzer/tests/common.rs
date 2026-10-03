use crate::models::audit_data::HttpPerformanceMeasurement;
use chrono::Utc;

pub(super) fn test_http_performance() -> HttpPerformanceMeasurement {
    HttpPerformanceMeasurement {
        measured_at: Utc::now(),
        method: "GET".into(),
        response_headers_ms: 100,
        body_read_ms: 2,
        total_request_ms: 102,
        decoded_body_bytes: 64,
        content_length_header_bytes: None,
        redirect_hops: 0,
        scope: "native_http_get_includes_redirects_no_browser_render".into(),
    }
}
