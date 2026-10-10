use super::{discover_from_process, tools::parse_tools, validate_server_path};
use serde_json::json;
use std::path::PathBuf;

#[test]
fn parses_server_discovered_tool_schemas() {
    let tools = parse_tools(&json!({
        "tools": [{
            "name": "seomi_audit_url",
            "description": "Audit one public URL.",
            "inputSchema": { "type": "object", "properties": { "url": { "type": "string" } } }
        }]
    }))
    .unwrap();
    assert_eq!(tools.len(), 1);
    assert_eq!(tools[0].name, "seomi_audit_url");
    assert_eq!(tools[0].input_schema["properties"]["url"]["type"], "string");
}

#[test]
fn rejects_invalid_or_excessive_tool_catalogs() {
    assert!(parse_tools(&json!({ "tools": [{ "name": "missing-schema" }] })).is_err());
    let too_many = (0..129)
        .map(
            |index| json!({ "name": format!("tool-{index}"), "inputSchema": { "type": "object" } }),
        )
        .collect::<Vec<_>>();
    assert!(parse_tools(&json!({ "tools": too_many })).is_err());
}

#[test]
fn invalid_catalog_shapes_and_tool_names_have_precise_errors() {
    for catalog in [json!({}), json!({"tools": null}), json!({"tools": {}})] {
        assert_eq!(
            parse_tools(&catalog).unwrap_err(),
            "MCP tools/list response did not contain a tools array."
        );
    }
    for name in [
        json!(null),
        json!(42),
        json!(""),
        json!("   "),
        json!("n".repeat(129)),
    ] {
        assert_eq!(
            parse_tools(&json!({"tools": [{"name": name, "inputSchema": {}}]})).unwrap_err(),
            "MCP server returned a tool with an invalid name."
        );
    }
    let name = "n".repeat(128);
    let result = parse_tools(&json!({"tools": [{"name": name, "inputSchema": {}}]})).unwrap();
    assert_eq!(result[0].name.len(), 128);
}

#[test]
fn catalog_descriptions_are_bounded_by_unicode_characters() {
    let result = parse_tools(&json!({"tools": [{
        "name": "fixture", "inputSchema": {}, "description": "ż".repeat(2001)
    }]}))
    .unwrap();
    assert_eq!(
        result[0].description.as_deref(),
        Some("ż".repeat(2000).as_str())
    );
}

#[test]
fn validates_explicit_absolute_javascript_server_path() {
    assert!(validate_server_path("relative/server.js").is_err());
    assert!(validate_server_path("/definitely/not/a/server.ts").is_err());
}

#[tokio::test]
async fn discovers_tools_from_the_built_seomi_server_when_available() {
    let server_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../mcp-server/dist/index.js");
    if !server_path.is_file() {
        return;
    }
    let discovery = discover_from_process(server_path.to_string_lossy().into_owned())
        .await
        .unwrap();
    assert_eq!(discovery.server_name, "seomi-mcp-server");
    assert_eq!(discovery.tools.len(), 18);
    assert!(discovery
        .tools
        .iter()
        .any(|tool| tool.name == "seomi_audit_url"));
    assert!(discovery
        .tools
        .iter()
        .any(|tool| tool.name == "seomi_crawl_site"));
    assert!(discovery
        .tools
        .iter()
        .any(|tool| tool.name == "seomi_research_backlink_anchors"));
    assert!(discovery
        .tools
        .iter()
        .any(|tool| tool.name == "seomi_research_backlink_pages"));
    assert!(discovery
        .tools
        .iter()
        .any(|tool| tool.name == "seomi_research_backlink_gap"));
    assert!(discovery
        .tools
        .iter()
        .any(|tool| tool.name == "seomi_research_ranked_keywords"));
    assert!(discovery
        .tools
        .iter()
        .any(|tool| tool.name == "seomi_pagespeed_insights"));
    assert!(discovery.tools.iter().any(|tool| tool.name == "seomi_crux"));
}
