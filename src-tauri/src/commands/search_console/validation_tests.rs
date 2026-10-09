use super::{
    credentials::{refresh_token_key, validate_client_id},
    dates::{date_range, requested_date_range},
    pkce::code_challenge,
    requests::site_path,
};

#[test]
fn accepts_desktop_oauth_client_ids_and_rejects_arbitrary_values() {
    assert!(validate_client_id("123.apps.googleusercontent.com").is_ok());
    assert!(validate_client_id("not a client id").is_err());
}

#[test]
fn project_tokens_are_separated_by_valid_project_ids() {
    assert_eq!(
        refresh_token_key("project-123").unwrap(),
        "gsc_refresh_token_project-123"
    );
    assert!(refresh_token_key("../outside").is_err());
}

#[test]
fn property_urls_are_encoded_as_one_path_segment() {
    assert_eq!(
        site_path("https://example.com/"),
        "https%3A%2F%2Fexample.com%2F"
    );
}

#[test]
fn query_date_window_is_28_complete_days_ending_three_days_ago() {
    let (start, end) = date_range();
    let start = chrono::NaiveDate::parse_from_str(&start, "%Y-%m-%d").unwrap();
    let end = chrono::NaiveDate::parse_from_str(&end, "%Y-%m-%d").unwrap();
    assert_eq!((end - start).num_days(), 27);
    assert_eq!((chrono::Utc::now().date_naive() - end).num_days(), 3);
}

#[test]
fn accepts_valid_requested_window_and_rejects_partial_or_invalid_dates() {
    assert_eq!(
        requested_date_range(Some("2026-01-01"), Some("2026-01-31")).unwrap(),
        ("2026-01-01".into(), "2026-01-31".into())
    );
    assert!(requested_date_range(Some("2026-02-30"), Some("2026-03-01")).is_err());
    assert!(requested_date_range(Some("2026-02-02"), Some("2026-02-01")).is_err());
    assert!(requested_date_range(Some("2026-01-01"), None).is_err());
    assert!(requested_date_range(Some("2999-01-01"), Some("2999-01-02")).is_err());
}

#[test]
fn defaults_to_the_complete_search_console_window_when_dates_are_omitted() {
    let before = date_range();
    let selected = requested_date_range(None, None).unwrap();
    let after = date_range();
    assert!(selected == before || selected == after);
}

#[test]
fn rejects_an_invalid_end_date_after_parsing_a_valid_start_date() {
    assert_eq!(
        requested_date_range(Some("2026-01-01"), Some("2026-02-30")).unwrap_err(),
        "End date must be a valid YYYY-MM-DD date."
    );
}

#[test]
fn creates_rfc7636_s256_challenge_from_the_verifier() {
    assert_eq!(
        code_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
        "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    );
}
