use super::{
    paths::node_program,
    protocol::receive_response,
    tools::parse_tools,
    transport::{protocol_receiver, OwnedChild},
};
use super::{McpDiscoveryResult, DISCOVERY_TIMEOUT};
use serde_json::{json, Value};
use std::{
    io::Write,
    process::{Command, Stdio},
    time::Instant,
};

pub(super) fn discover_from_process_blocking(path: String) -> Result<McpDiscoveryResult, String> {
    let mut child = OwnedChild(
        Command::new(node_program())
            .arg(path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| {
                "Node.js was not found on PATH. Install Node.js and restart the desktop app."
                    .to_string()
            })?,
    );
    let mut stdin = child
        .0
        .stdin
        .take()
        .ok_or_else(|| "Could not open MCP server input.".to_string())?;
    let stdout = child
        .0
        .stdout
        .take()
        .ok_or_else(|| "Could not open MCP server output.".to_string())?;
    let line_receiver = protocol_receiver(stdout);

    let requests = [
        json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": { "name": "SEOmi", "version": env!("CARGO_PKG_VERSION") }
            }
        }),
        json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }),
        json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {} }),
    ];
    for request in requests {
        let mut line = serde_json::to_vec(&request)
            .map_err(|_| "Could not encode MCP request.".to_string())?;
        line.push(b'\n');
        stdin
            .write_all(&line)
            .map_err(|_| "Could not write to the MCP server process.".to_string())?;
    }
    stdin
        .flush()
        .map_err(|_| "Could not flush the MCP server request.".to_string())?;
    drop(stdin);

    let deadline = Instant::now() + DISCOVERY_TIMEOUT;
    let mut total_bytes = 0usize;
    let mut total_lines = 0usize;
    let initialized = receive_response(
        &line_receiver,
        1,
        deadline,
        &mut total_bytes,
        &mut total_lines,
    )?;
    let listing = receive_response(
        &line_receiver,
        2,
        deadline,
        &mut total_bytes,
        &mut total_lines,
    )?;
    drop(child);
    let server_info = initialized
        .get("serverInfo")
        .ok_or_else(|| "MCP initialize response did not identify the server.".to_string())?;
    let server_name = server_info
        .get("name")
        .and_then(Value::as_str)
        .filter(|name| !name.trim().is_empty())
        .ok_or_else(|| "MCP initialize response contained no server name.".to_string())?
        .chars()
        .take(128)
        .collect::<String>();
    let server_version = server_info
        .get("version")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .chars()
        .take(64)
        .collect::<String>();

    let tools = parse_tools(&listing)?;
    Ok(McpDiscoveryResult {
        server_name,
        server_version,
        tools,
    })
}

pub(super) async fn discover_from_process(path: String) -> Result<McpDiscoveryResult, String> {
    tokio::task::spawn_blocking(move || discover_from_process_blocking(path))
        .await
        .map_err(|_| "MCP discovery worker stopped unexpectedly.".to_string())?
}
