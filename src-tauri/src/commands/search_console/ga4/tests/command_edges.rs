use super::super::commands::{
    connect_google_analytics, google_analytics_performance, list_google_analytics_properties,
};

const CLIENT_ID: &str = "1234567890-test.apps.googleusercontent.com";
const PROJECT_ID: &str = "test-project-id";
const SITE_URL: &str = "https://example.com";

#[tokio::test]
async fn list_properties_proceeds_to_credential_lookup() {
    let err =
        list_google_analytics_properties(PROJECT_ID.into(), CLIENT_ID.into(), SITE_URL.into())
            .await
            .unwrap_err();
    assert!(
        err.contains("credential store") || err.contains("token is missing"),
        "unexpected error: {err}"
    );
}

#[tokio::test]
async fn performance_proceeds_to_credential_lookup() {
    let err = google_analytics_performance(
        PROJECT_ID.into(),
        CLIENT_ID.into(),
        SITE_URL.into(),
        Some("2026-01-01".into()),
        Some("2026-01-02".into()),
    )
    .await
    .unwrap_err();
    assert!(
        err.contains("credential store") || err.contains("token is missing"),
        "unexpected error: {err}"
    );
}

#[tokio::test]
async fn connect_with_client_secret_validates_inputs() {
    let err = connect_google_analytics(
        PROJECT_ID.into(),
        "invalid-client".into(),
        Some("secret".into()),
    )
    .await
    .unwrap_err();
    assert!(err.contains("valid Desktop app OAuth Client ID"));
}
