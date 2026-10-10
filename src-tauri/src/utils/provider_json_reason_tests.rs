use super::{read_provider_json, tests::reply};

#[tokio::test]
async fn failed_http_names_only_a_known_reason_with_its_fixed_hint() {
    let missing_secret =
        br#"{"error":"invalid_request","error_description":"client_secret is missing."}"#;
    let error = read_provider_json(
        reply("400 Bad Request", missing_secret, false).await,
        100,
        "Fixture",
    )
    .await
    .unwrap_err();
    assert!(error.starts_with("Fixture HTTP 400 Bad Request: request failed (invalid_request). "));
    assert!(!error.contains("client_secret is missing"));
    let oversized = format!(
        r#"{{"error":"invalid_client","pad":"{}"}}"#,
        "x".repeat(17_000)
    );
    let error = read_provider_json(
        reply("401 Unauthorized", oversized.as_bytes(), true).await,
        100,
        "Fixture",
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Fixture HTTP 401 Unauthorized: request failed.");
}
