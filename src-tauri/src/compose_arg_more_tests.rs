//! Last-argument decode failures for composed commands (shipped handler table).
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::{json, Map, Value};
use tauri::test::mock_builder;

fn payload(valid: Value, key: &str, bad: Value) -> Value {
    let mut map: Map<String, Value> = valid.as_object().cloned().unwrap_or_default();
    map.insert(key.to_string(), bad);
    Value::Object(map)
}

#[test]
fn composed_commands_reject_undecodable_last_argument() {
    let fixture = StorageApp::new(super::compose(mock_builder()));
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();
    let s = json!("x");
    let bad = json!(true);
    let cases = [
        (
            "connect_search_console",
            json!({"projectId": s, "clientId": s}),
            "clientSecret",
        ),
        (
            "list_search_console_properties",
            json!({"projectId": s}),
            "clientId",
        ),
        (
            "search_console_performance",
            json!({"projectId": s, "clientId": s, "siteUrl": s}),
            "filters",
        ),
        (
            "inspect_search_console_url",
            json!({"projectId": s, "clientId": s, "siteUrl": s}),
            "inspectionUrl",
        ),
        ("disconnect_search_console", json!({}), "projectId"),
        (
            "save_crawl_auth_profile",
            json!({"projectId": s, "profileId": s, "headers": []}),
            "proxyUrl",
        ),
        (
            "delete_crawl_auth_profile",
            json!({"projectId": s}),
            "profileId",
        ),
        ("has_secret", json!({}), "name"),
        ("set_secret", json!({"name": s}), "value"),
        ("test_ai_cli_connection", json!({}), "provider"),
        ("run_ai_cli", json!({"provider": s, "prompt": s}), "model"),
        (
            "open_rendered_element_preview",
            json!({"url": s, "selector": s, "previewTitle": s}),
            "notFoundMessage",
        ),
        (
            "connect_google_analytics",
            json!({"projectId": s, "clientId": s}),
            "clientSecret",
        ),
        (
            "list_google_analytics_properties",
            json!({"projectId": s, "clientId": s}),
            "siteUrl",
        ),
        (
            "google_analytics_performance",
            json!({"projectId": s, "clientId": s, "siteUrl": s}),
            "endDate",
        ),
        (
            "run_pagespeed_insights",
            json!({"projectId": s, "url": s}),
            "strategy",
        ),
        (
            "query_crux_record",
            json!({"projectId": s, "url": s, "formFactor": s}),
            "originScope",
        ),
        ("check_link", json!({"url": s}), "timeoutSecs"),
        ("discover_mcp_tools", json!({}), "serverPath"),
        (
            "fetch_public_feed",
            json!({"feed": s, "geo": s, "keyword": s}),
            "language",
        ),
        (
            "ai_generate_text",
            json!({"provider": s, "model": s}),
            "prompt",
        ),
        (
            "ai_generate_suggestions",
            json!({"provider": s, "model": s}),
            "prompt",
        ),
        ("ai_list_models", json!({}), "provider"),
        ("ai_test_connection", json!({}), "provider"),
        (
            "check_external_crawl_links",
            json!({"requestId": s, "urls": []}),
            "maxUrls",
        ),
        (
            "render_crawl_page",
            json!({"url": s, "allowSubdomains": true}),
            "lazyScrollCycles",
        ),
        (
            "capture_rendered_artifact",
            json!({"url": s, "allowSubdomains": true, "kind": s}),
            "runId",
        ),
        ("save_config", json!({}), "config"),
        ("crawl_site", json!({"startUrl": s}), "config"),
    ];
    for (command, valid, key) in cases {
        let value = if key == "originScope" {
            json!("x")
        } else {
            bad.clone()
        };
        let error = invoke(&view, command, payload(valid, key, value)).unwrap_err();
        assert!(error.is_string(), "{command}: {error}");
    }
}
