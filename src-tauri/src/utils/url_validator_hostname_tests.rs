use super::*;

#[test]
fn trailing_dot_local_names_are_blocked_like_their_canonical_form() {
    for input in [
        "http://localhost./",
        "https://printer.local./",
        "https://api.internal./x",
        "https://router.lan..",
    ] {
        assert_eq!(
            validate_and_normalize_url(input),
            Err(UrlValidationError::BlockedLocalhost),
            "{input}"
        );
    }
}

#[test]
fn scheme_less_input_with_url_in_query_still_gets_https() {
    let url = validate_and_normalize_url("example.com/login?next=https://example.com/a").unwrap();
    assert_eq!(url.scheme(), "https");
    assert_eq!(url.host_str(), Some("example.com"));
    assert_eq!(url.query(), Some("next=https://example.com/a"));
}

#[test]
fn explicit_non_http_schemes_stay_rejected() {
    assert_eq!(
        validate_and_normalize_url("ftp://example.com/"),
        Err(UrlValidationError::UnsupportedScheme("ftp".into()))
    );
    assert_eq!(
        validate_and_normalize_url("FILE:///etc/passwd"),
        Err(UrlValidationError::UnsupportedScheme("file".into()))
    );
}
