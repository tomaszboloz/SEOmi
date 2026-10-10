mod paths;
mod process;
mod protocol;
mod tools;
mod transport;
mod types;

use paths::validate_server_path;
use process::discover_from_process;
pub use types::{DiscoveredMcpTool, McpDiscoveryResult};

const DISCOVERY_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(12);
const MAX_PROTOCOL_LINE_BYTES: usize = 1024 * 1024;
const MAX_PROTOCOL_LINES: usize = 64;
const MAX_TOOLS: usize = 128;

#[tauri::command]
pub async fn discover_mcp_tools(server_path: String) -> Result<McpDiscoveryResult, String> {
    let path = validate_server_path(&server_path)?;
    tokio::time::timeout(DISCOVERY_TIMEOUT, discover_from_process(path))
        .await
        .map_err(|_| "MCP discovery timed out after 12 seconds.".to_string())?
}

#[cfg(test)]
#[path = "mcp_discovery/paths_tests.rs"]
mod paths_tests;
#[cfg(test)]
mod process_tests;
#[cfg(test)]
mod process_tests_error_paths;
#[cfg(test)]
mod process_tests_next;
#[cfg(test)]
mod protocol_tests;
#[cfg(test)]
#[path = "mcp_discovery/public_api_tests.rs"]
mod public_api_tests;
#[cfg(test)]
mod response_tests;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod transport_tests;
