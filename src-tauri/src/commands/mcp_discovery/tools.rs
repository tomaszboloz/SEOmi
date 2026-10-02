use super::{DiscoveredMcpTool, MAX_TOOLS};
use serde_json::Value;

pub(super) fn parse_tools(result: &Value) -> Result<Vec<DiscoveredMcpTool>, String> {
    let entries = result
        .get("tools")
        .and_then(Value::as_array)
        .ok_or_else(|| "MCP tools/list response did not contain a tools array.".to_string())?;
    if entries.len() > MAX_TOOLS {
        return Err(format!(
            "MCP server returned more than {MAX_TOOLS} tools; discovery was stopped."
        ));
    }
    let mut tools = Vec::with_capacity(entries.len());
    for entry in entries {
        let name = entry
            .get("name")
            .and_then(Value::as_str)
            .filter(|name| !name.trim().is_empty() && name.len() <= 128)
            .ok_or_else(|| "MCP server returned a tool with an invalid name.".to_string())?;
        let input_schema = entry
            .get("inputSchema")
            .filter(|schema| schema.is_object())
            .cloned()
            .ok_or_else(|| format!("MCP tool {name} did not provide a JSON Schema object."))?;
        tools.push(DiscoveredMcpTool {
            name: name.to_string(),
            description: entry
                .get("description")
                .and_then(Value::as_str)
                .map(|description| description.chars().take(2000).collect()),
            input_schema,
        });
    }
    Ok(tools)
}
