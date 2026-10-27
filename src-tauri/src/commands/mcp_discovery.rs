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
    within(DISCOVERY_TIMEOUT, discover_from_process(path)).await
}

async fn within<T>(
    limit: std::time::Duration,
    work: impl std::future::Future<Output = Result<T, String>>,
) -> Result<T, String> {
    tokio::time::timeout(limit, work)
        .await
        .map_err(|_| "MCP discovery timed out after 12 seconds.".to_string())?
}

#[cfg(test)]
mod timeout_tests {
    use super::within;
    use std::time::Duration;

    #[tokio::test]
    async fn work_that_outlives_the_limit_reports_the_timeout() {
        let stuck = within::<()>(Duration::from_millis(5), std::future::pending()).await;
        assert_eq!(
            stuck.unwrap_err(),
            "MCP discovery timed out after 12 seconds."
        );
        assert_eq!(within(Duration::from_secs(5), async { Ok(7) }).await, Ok(7));
    }
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
mod protocol_read_error_tests;
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
