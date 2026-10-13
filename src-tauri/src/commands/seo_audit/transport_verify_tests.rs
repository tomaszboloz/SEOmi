use super::transport::fetch_and_analyze_with_resolver;
use super::transport_tests::{fixture, HTML};
use std::time::Duration;
use url::Url;

#[tokio::test]
async fn default_redirect_limit_with_tls_verification_disabled_keeps_the_caller_option() {
    let address = fixture("200 OK", HTML).await;
    let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
    let report = fetch_and_analyze_with_resolver(
        &url,
        "FixtureBot",
        Duration::from_secs(1),
        10,
        false,
        move |_| async move { Ok(vec![address]) },
    )
    .await
    .unwrap();
    assert_eq!(report.http_status, 200);
    assert_eq!(report.meta_tags.title.as_deref(), Some("Fixture SEO page"));
}
