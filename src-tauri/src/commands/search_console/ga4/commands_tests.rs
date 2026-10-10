use super::super::connect::oauth_request_with_scope;
use super::commands::{
    connect_google_analytics, google_analytics_performance, list_google_analytics_properties,
    GA4_OAUTH_SCOPE,
};

const CLIENT_ID: &str = "fixture.apps.googleusercontent.com";
const PROJECT_ID: &str = "fixture-project";
const SITE_URL: &str = "https://example.com";

#[test]
fn ga4_oauth_requests_both_google_scopes() {
    let (_, state, verifier, url) = oauth_request_with_scope(CLIENT_ID, 43127, GA4_OAUTH_SCOPE)
        .expect("OAuth request should be buildable");
    let query = url.query_pairs().into_owned().collect::<Vec<_>>();
    let scope = query
        .iter()
        .find(|(name, _)| name == "scope")
        .map(|(_, value)| value.as_str())
        .expect("OAuth request must include a scope");

    assert_eq!(scope, GA4_OAUTH_SCOPE);
    assert!(scope.contains("https://www.googleapis.com/auth/webmasters.readonly"));
    assert!(scope.contains("https://www.googleapis.com/auth/analytics.readonly"));
    assert_eq!(state.len(), 32);
    assert_eq!(verifier.len(), 64);
}

#[tokio::test]
async fn connect_rejects_invalid_client_or_project_before_credentials() {
    let invalid_client =
        connect_google_analytics(PROJECT_ID.into(), "not-an-oauth-client".into(), None)
            .await
            .unwrap_err();
    assert!(invalid_client.contains("valid Desktop app OAuth Client ID"));

    let invalid_project = connect_google_analytics("bad/project".into(), CLIENT_ID.into(), None)
        .await
        .unwrap_err();
    assert_eq!(
        invalid_project,
        "Invalid Google Search Console project identifier."
    );
}

#[tokio::test]
async fn list_rejects_site_client_and_project_before_network() {
    let invalid_site =
        list_google_analytics_properties(PROJECT_ID.into(), CLIENT_ID.into(), " ".into())
            .await
            .unwrap_err();
    assert_eq!(invalid_site, "Google Analytics site URL is invalid.");

    let invalid_client = list_google_analytics_properties(
        PROJECT_ID.into(),
        "invalid-client".into(),
        SITE_URL.into(),
    )
    .await
    .unwrap_err();
    assert!(invalid_client.contains("valid Desktop app OAuth Client ID"));

    let invalid_project =
        list_google_analytics_properties("bad/project".into(), CLIENT_ID.into(), SITE_URL.into())
            .await
            .unwrap_err();
    assert_eq!(
        invalid_project,
        "Invalid Google Search Console project identifier."
    );
}

#[tokio::test]
async fn performance_rejects_site_and_date_contract_errors_before_credentials() {
    let invalid_site = google_analytics_performance(
        PROJECT_ID.into(),
        CLIENT_ID.into(),
        "https://user:secret@example.com".into(),
        None,
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(invalid_site, "Google Analytics site URL is invalid.");

    let incomplete_range = google_analytics_performance(
        PROJECT_ID.into(),
        CLIENT_ID.into(),
        SITE_URL.into(),
        Some("2026-01-01".into()),
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(incomplete_range, "Podaj obie daty zakresu Search Console.");

    let invalid_date = google_analytics_performance(
        PROJECT_ID.into(),
        CLIENT_ID.into(),
        SITE_URL.into(),
        Some("not-a-date".into()),
        Some("2026-01-02".into()),
    )
    .await
    .unwrap_err();
    assert_eq!(invalid_date, "Start date must be a valid YYYY-MM-DD date.");

    let reversed_range = google_analytics_performance(
        PROJECT_ID.into(),
        CLIENT_ID.into(),
        SITE_URL.into(),
        Some("2026-01-03".into()),
        Some("2026-01-02".into()),
    )
    .await
    .unwrap_err();
    assert_eq!(
        reversed_range,
        "Start date must not be later than end date."
    );
}
