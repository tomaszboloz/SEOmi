//! Drives the shipped command surface through `compose` on the mock runtime.
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

#[tokio::test]
async fn composed_handlers_reject_invalid_input_before_any_network_or_cli_work() {
    let fixture = StorageApp::new(super::compose(mock_builder()));
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();
    let rejected = |command: &str, body: serde_json::Value| {
        invoke(&view, command, body)
            .expect_err(command)
            .as_str()
            .unwrap()
            .to_owned()
    };

    assert!(rejected(
        "run_pagespeed_insights",
        json!({ "projectId": "", "url": "https://example.com", "strategy": "mobile" })
    )
    .contains("Invalid project identifier"));
    assert!(rejected(
        "query_crux_record",
        json!({ "projectId": "", "url": "https://example.com", "formFactor": "PHONE", "originScope": true })
    )
    .contains("Invalid project identifier"));
    assert_eq!(
        rejected("test_ai_cli_connection", json!({ "provider": "nope" })),
        "Unsupported AI provider."
    );
    assert!(!rejected(
        "run_ai_cli",
        json!({ "provider": "nope", "prompt": "hi", "model": null })
    )
    .is_empty());
    assert!(
        rejected("discover_mcp_tools", json!({ "serverPath": "relative.js" }))
            .contains("absolute path")
    );
    assert!(rejected(
        "inspect_url",
        json!({ "url": "", "userAgent": null, "timeoutSecs": null, "maxRedirects": null,
                "verifySsl": null, "requestId": null })
    )
    .contains("URL validation failed"));
    assert!(!rejected(
        "crawl_site",
        json!({ "startUrl": "", "maxPages": null, "userAgent": null, "runId": null,
                "projectId": null, "config": null })
    )
    .is_empty());
    assert!(rejected(
        "connect_google_analytics",
        json!({ "projectId": "p", "clientId": "not-a-client", "clientSecret": null })
    )
    .contains("Client ID"));
    assert!(!rejected(
        "list_google_analytics_properties",
        json!({ "projectId": "p", "clientId": "c", "siteUrl": "https://user:pw@example.test" })
    )
    .is_empty());
    assert!(!rejected(
        "google_analytics_performance",
        json!({ "projectId": "p", "clientId": "c", "siteUrl": "https://user:pw@example.test",
                "startDate": null, "endDate": null })
    )
    .is_empty());
}
