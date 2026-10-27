import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createSeoMiServer } from '../dist/server.js';
import { withClient } from './testHelpers.mjs';

const recordingDependencies = (calls) => {
  const runner = (kind) => async (...args) => {
    calls.push([kind, ...args]);
    return { status_code: 20000, result: [{ target: args[1]?.[0]?.target ?? null }] };
  };
  return {
    audit: runner('audit'),
    crawl: runner('crawl'),
    publicTarget: async (url) => url,
    providers: {
      dataForSeo: runner('dataForSeo'),
      googleJson: runner('googleJson'),
      googlePublicJson: runner('googlePublicJson'),
      googleApiKey: () => 'fixture',
    },
  };
};

const initialize = (id) => JSON.stringify({
  jsonrpc: '2.0',
  id,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'seomi-fuzz', version: '1.0.0' } },
});

test('stdio entry drops malformed frames and keeps answering valid JSON-RPC requests', { timeout: 30_000 }, async () => {
  const child = spawn(process.execPath, ['dist/index.js'], { stdio: ['pipe', 'pipe', 'ignore'] });
  const responses = new Map();
  const waiters = new Map();
  createInterface({ input: child.stdout }).on('line', (line) => {
    const message = JSON.parse(line);
    responses.set(message.id, message);
    waiters.get(message.id)?.();
  });
  const responseFor = (id) => responses.has(id)
    ? Promise.resolve(responses.get(id))
    : new Promise((resolve) => waiters.set(id, () => resolve(responses.get(id))));
  try {
    child.stdin.write('this is not json\n');
    child.stdin.write('{"jsonrpc":"1.0","id":1,"method":"tools/list"}\n');
    child.stdin.write('{"jsonrpc":"2.0","id":"truncated"\n');
    child.stdin.write(`${initialize(2)}\n`);
    const init = await responseFor(2);
    assert.equal(init.result.serverInfo.name, 'seomi-mcp-server');
    child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
    child.stdin.write('{"jsonrpc":"2.0","id":3,"method":"tools/list"}\n');
    const list = await responseFor(3);
    assert.ok(list.result.tools.some((tool) => tool.name === 'seomi_audit_url'));
    assert.equal(responses.has(1), false, 'a JSON-RPC 1.0 frame must not be answered as a 2.0 request');
    assert.equal(responses.has('truncated'), false);
  } finally {
    child.kill();
    if (child.exitCode === null) await once(child, 'exit');
  }
});

test('unknown tools and type-mismatched arguments fail as tool errors without reaching a provider', async () => {
  const calls = [];
  await withClient(recordingDependencies(calls), async (client) => {
    const unknown = await client.callTool({ name: 'seomi_unknown_tool_fuzz', arguments: {} });
    assert.equal(unknown.isError, true);
    assert.match(unknown.content[0].text, /-32602.*seomi_unknown_tool_fuzz not found/);

    for (const url of [12345, null, ['https://example.com'], { href: 'https://example.com' }]) {
      const mismatch = await client.callTool({ name: 'seomi_audit_url', arguments: { url } });
      assert.equal(mismatch.isError, true, `url=${JSON.stringify(url)}`);
      assert.match(mismatch.content[0].text, /Input validation error/);
    }
    assert.deepEqual(calls, []);
  });
});

test('an unknown JSON-RPC method returns -32601 and the session keeps serving requests', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createSeoMiServer(recordingDependencies([]));
  const received = [];
  clientTransport.onmessage = (message) => received.push(message);
  try {
    await server.connect(serverTransport);
    await clientTransport.start();
    await clientTransport.send({ jsonrpc: '2.0', id: 7, method: 'seomi/does-not-exist', params: {} });
    await clientTransport.send({ jsonrpc: '2.0', id: 8, method: 'tools/list', params: {} });
    for (let tick = 0; tick < 100 && received.length < 2; tick += 1) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(received.find((message) => message.id === 7).error.code, -32601);
    assert.ok(received.find((message) => message.id === 8).result.tools.length > 0);
  } finally {
    await server.close();
  }
});

test('concurrent tool calls each receive the response for their own arguments', async () => {
  const calls = [];
  await withClient(recordingDependencies(calls), async (client) => {
    const targets = Array.from({ length: 15 }, (_, index) => `site-${index}.example.com`);
    const results = await Promise.all(targets.map((target) => client.callTool({
      name: 'seomi_research_domain_overview',
      arguments: { target },
    })));
    assert.deepEqual(results.map((result) => result.structuredContent.result[0].target), targets);
    assert.equal(results.every((result) => result.isError === false), true);
    assert.equal(calls.length, targets.length);
  });
});
