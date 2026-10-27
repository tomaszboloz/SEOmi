use super::super::commands::{
    connect_google_analytics, google_analytics_performance, list_google_analytics_properties,
};

const CLIENT_ID: &str = "1234567890-test.apps.googleusercontent.com";
const PROJECT_ID: &str = "test-project-id";

#[tokio::test]
async fn list_properties_rejects_invalid_site_before_credentials() {
    let error = list_google_analytics_properties(
        PROJECT_ID.into(),
        CLIENT_ID.into(),
        "ftp://example.com".into(),
    )
    .await
    .unwrap_err();

    assert_eq!(error, "Google Analytics site URL is invalid.");
}

#[tokio::test]
async fn performance_rejects_invalid_date_before_credentials() {
    let error = google_analytics_performance(
        PROJECT_ID.into(),
        CLIENT_ID.into(),
        "https://example.com".into(),
        Some("2026-02-01".into()),
        Some("2026-01-01".into()),
    )
    .await
    .unwrap_err();

    assert_eq!(error, "Start date must not be later than end date.");
}

#[tokio::test]
async fn performance_rejects_invalid_client_before_credentials() {
    let error = google_analytics_performance(
        PROJECT_ID.into(),
        "invalid-client".into(),
        "https://example.com".into(),
        Some("2026-01-01".into()),
        Some("2026-02-01".into()),
    )
    .await
    .unwrap_err();

    assert!(error.contains("valid Desktop app OAuth Client ID"));
}

#[tokio::test]
async fn list_properties_rejects_invalid_project_before_network() {
    let error = list_google_analytics_properties(
        "project with spaces".into(),
        CLIENT_ID.into(),
        "https://example.com".into(),
    )
    .await
    .unwrap_err();

    assert_eq!(error, "Invalid Google Search Console project identifier.");
}

#[tokio::test]
async fn connect_rejects_invalid_project_before_opening_browser() {
    let error = connect_google_analytics("project/with/slash".into(), CLIENT_ID.into(), None)
        .await
        .unwrap_err();

    assert_eq!(error, "Invalid Google Search Console project identifier.");
}
