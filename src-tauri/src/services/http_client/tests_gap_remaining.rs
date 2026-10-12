use super::{entry::fetch_page_with_options, header_capture::capture_headers};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use url::Url;

#[test]
fn header_capture_skips_values_that_cannot_be_represented_as_text() {
    let mut headers = HeaderMap::new();
    headers.append(
        HeaderName::from_static("x-valid"),
        HeaderValue::from_static("one"),
    );
    headers.append(
        HeaderName::from_static("x-valid"),
        HeaderValue::from_static("two"),
    );
    headers.append(
        HeaderName::from_static("x-invalid"),
        HeaderValue::from_bytes(&[0xff]).expect("non-UTF8 header bytes are valid HTTP values"),
    );
    let (last, repeated) = capture_headers(&headers);
    assert_eq!(last.get("x-valid").map(String::as_str), Some("two"));
    assert_eq!(repeated["x-valid"], ["one", "two"]);
    assert!(!last.contains_key("x-invalid"));
    assert!(!repeated.contains_key("x-invalid"));
}

#[tokio::test]
async fn public_entry_resolves_a_valid_domain_before_reporting_dns_failure() {
    let url = Url::parse("http://non-existent-domain.invalid/").unwrap();
    let error = fetch_page_with_options(&url, "SEOmi-test", 2, 0, true)
        .await
        .expect_err("the reserved test domain must not resolve");
    assert!(error.to_string().contains("DNS") || error.to_string().contains("dns"));
}

#[tokio::test]
async fn domain_resolution_reaches_address_validation_for_localhost() {
    let url = Url::parse("http://localhost/").unwrap();
    let error = super::resolver::resolve_public_addresses(&url)
        .await
        .expect_err("localhost must be rejected as a private address");
    assert!(error.to_string().contains("private") || error.to_string().contains("DNS"));
}
