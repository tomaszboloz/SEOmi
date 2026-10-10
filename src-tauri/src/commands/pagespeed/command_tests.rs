use super::{query_crux_record, query_crux_request, run_pagespeed_insights, run_pagespeed_request};

#[tokio::test]
async fn performance_commands_reject_invalid_project_before_secret_or_network() {
    let error = run_pagespeed_insights(
        "project/escape".into(),
        "https://example.com/".into(),
        "mobile".into(),
    )
    .await
    .unwrap_err();
    assert_eq!(
        error,
        "Invalid project identifier for Google performance request."
    );

    let error = query_crux_record(
        "project/escape".into(),
        "https://example.com/".into(),
        "PHONE".into(),
        false,
    )
    .await
    .unwrap_err();
    assert_eq!(
        error,
        "Invalid project identifier for Google performance request."
    );
}

#[tokio::test]
async fn provider_status_errors_are_redacted_for_pagespeed_and_crux() {
    let (endpoint, request) = super::local_reply(
        "403 Forbidden",
        r#"{"error":{"message":"fixture-provider-secret"}}"#,
    )
    .await;
    let error = run_pagespeed_request(
        "https://example.com/",
        "mobile",
        &endpoint,
        "fixture-key",
        &super::client(),
    )
    .await
    .unwrap_err();
    assert!(error.contains("403"));
    assert!(!error.contains("fixture-provider-secret"));
    assert!(
        request.await.is_ok(),
        "PageSpeed request should reach the provider fixture before redaction"
    );

    let (endpoint, request) = super::local_reply(
        "403 Forbidden",
        r#"{"error":{"message":"fixture-provider-secret"}}"#,
    )
    .await;
    let error = query_crux_request(
        "https://example.com/",
        "PHONE",
        false,
        &endpoint,
        "fixture-key",
        &super::client(),
    )
    .await
    .unwrap_err();
    assert!(error.contains("403"));
    assert!(!error.contains("fixture-provider-secret"));
    assert!(
        request.await.is_ok(),
        "CrUX request should reach the provider fixture before redaction"
    );
}

#[tokio::test]
async fn public_metric_commands_load_project_key_before_local_validation() {
    let project = "pagespeed-wrapper-coverage";
    let entry =
        crate::commands::settings::secret_entry(&format!("google_metrics_api_key_{project}"))
            .unwrap();
    entry.set_password("fixture-google-key").unwrap();

    let page_error = run_pagespeed_insights(
        project.into(),
        "http://127.0.0.1/private".into(),
        "mobile".into(),
    )
    .await
    .unwrap_err();
    assert!(page_error.contains("local/private IP"));

    let crux_error = query_crux_record(
        project.into(),
        "https://example.com/".into(),
        "MOBILE".into(),
        false,
    )
    .await
    .unwrap_err();
    assert_eq!(
        crux_error,
        "CrUX form factor must be PHONE, DESKTOP, or TABLET."
    );
    entry.delete_credential().unwrap();
}
