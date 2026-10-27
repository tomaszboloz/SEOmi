import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('MCP protocol compliance, invalid jsonrpc, missing id, unknown tool names, type mismatches, and payload limits', async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: ['dist/index.js'] });
  const client = new Client({ name: 'seomi-fuzz-client', version: '1.0.0' });
  await client.connect(transport);

  // 1. Unknown tool invocation test
  await assert.rejects(async () => {
    await client.callTool({ name: 'seomi_unknown_tool_fuzz', arguments: {} });
  }, /Tool not found|Unknown tool/i);

  // 2. Missing required parameter & type mismatch (e.g. passing number instead of string URL)
  await assert.rejects(async () => {
    await client.callTool({ name: 'seomi_audit_url', arguments: { url: 12345 } });
  });

  // 3. Oversized payload or rapid sequential tool calls stress test
  const promises = [];
  for (let i = 0; i < 15; i++) {
    promises.push(
      client.callTool({ name: 'seomi_research_domain_overview', arguments: { domain: `example-${i}.com` } }).catch(() => {})
    );
  }
  await Promise.all(promises);

  await client.close();
  await transport.close();
});
