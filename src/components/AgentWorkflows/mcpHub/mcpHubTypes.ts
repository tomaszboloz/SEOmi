export interface DiscoveredMcpTool {
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown>;
}

export interface McpDiscoveryResult {
  serverName: string;
  serverVersion: string;
  tools: DiscoveredMcpTool[];
}

export const getClaudeConfig = (serverPath: string) => ({
  mcpServers: {
    seomi: {
      command: 'node',
      args: [serverPath.trim()],
    },
  },
});

export const getCursorConfig = (serverPath: string) => ({
  mcpServers: {
    'seomi-assistant': {
      type: 'stdio',
      command: 'node',
      args: [serverPath.trim()],
    },
  },
});

export const getCodexConfig = (serverPath: string) =>
  `[mcp_servers.seomi]\ncommand = "node"\nargs = [${JSON.stringify(serverPath.trim())}]`;

export const getGeminiConfig = (serverPath: string) => ({
  mcpServers: {
    seomi: {
      command: 'node',
      args: [serverPath.trim()],
    },
  },
});

export const getActiveConfigString = (mcpClientTab: string, serverPath: string) => {
  switch (mcpClientTab) {
    case 'claude':
      return JSON.stringify(getClaudeConfig(serverPath), null, 2);
    case 'cursor':
      return JSON.stringify(getCursorConfig(serverPath), null, 2);
    case 'gemini':
      return JSON.stringify(getGeminiConfig(serverPath), null, 2);
    case 'codex':
    default:
      return getCodexConfig(serverPath);
  }
};
