// -------------------------------------------------------------
// MCP Server & Search Console Models
// -------------------------------------------------------------
export interface McpToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
