//! Drives the composed handler table with malformed argument payloads.
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

#[test]
fn composed_commands_reject_payloads_missing_required_arguments() {
    let fixture = StorageApp::new(crate::compose(mock_builder()));
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();
    for command in [
        "ai_generate_text",
        "ai_generate_suggestions",
        "ai_list_models",
        "ai_test_connection",
        "run_pagespeed_insights",
        "query_crux_record",
        "fetch_public_feed",
        "rdap_domain_lookup",
        "inspect_url",
        "check_link",
    ] {
        let error = invoke(&view, command, json!({})).unwrap_err();
        assert!(error.as_str().unwrap().contains("missing required key"));
    }
}
