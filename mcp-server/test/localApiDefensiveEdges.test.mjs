import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import process from 'node:process';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const child = `
import { mock } from 'node:test';
import http from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
const mode = process.argv[1];
const servers = [];
const createFixtureServer = (_options, handler) => {
  const server = {
    once(event, callback) { if (event === 'listening') globalThis.queueMicrotask(callback); return this; },
    off() { return this; },
    listen() { return this; },
    address() { return mode === 'address-null' ? null : mode === 'address-string' ? 'fixture' : { port: 43210 }; },
    close(callback) { this.closed = true; callback(mode === 'close-error' ? new Error('close fixture') : undefined); },
    invoke(request, response) { handler(request, response); },
  };
  servers.push(server);
  return server;
};
mock.method(http, 'createServer', createFixtureServer);
syncBuiltinESMExports();
const { startLocalApi } = await import('./mcp-server/dist/localApi.js?edge=' + mode);
const token = 'local-api-edge-contract-token';
const output = (value) => console.log(JSON.stringify(value));
const responseFixture = (sent = false) => {
  let finish;
  return {
    statusCode: 200,
    headersSent: sent,
    setHeader() {},
    once(event, callback) { if (event === 'finish') finish = callback; },
    end(body) { this.statusCode = this.statusCode || 200; this.body = body; this.headersSent = true; finish?.(); },
    destroy() { this.destroyed = true; },
  };
};
if (mode === 'address-null' || mode === 'address-string') {
  try { await startLocalApi({ token, logger: () => {} }); } catch (error) { output({ message: error.message, closed: servers[0].closed }); }
} else if (mode === 'outer-unsent' || mode === 'outer-sent') {
  const logs = [];
  const api = await startLocalApi({ token, audit: async () => ({}), logger: (entry) => logs.push(entry) });
  const request = {};
  Object.defineProperty(request, 'headers', { get() { throw new Error('fixture headers'); } });
  request.method = 'GET'; request.url = '/health';
  const response = responseFixture(mode === 'outer-sent');
  servers[0].invoke(request, response);
  await new Promise((resolve) => setImmediate(resolve));
  await api.close();
  output({ status: response.statusCode, body: response.body, destroyed: !!response.destroyed, logs });
} else if (mode === 'url-fallback') {
  const logs = [];
  const api = await startLocalApi({ token, audit: async () => ({ fixture: 'audit' }), logger: (entry) => logs.push(entry) });
  let urlReads = 0;
  const request = {
    method: 'POST', headers: { authorization: 'Bearer ' + token },
    async *[Symbol.asyncIterator]() { yield Buffer.from('{"url":"https://example.test/"}'); },
  };
  Object.defineProperty(request, 'url', { get() { return urlReads++ === 0 ? '/v1/audit' : undefined; } });
  const response = responseFixture();
  servers[0].invoke(request, response);
  await new Promise((resolve) => setImmediate(resolve));
  await api.close();
  output({ status: response.statusCode, result: JSON.parse(response.body).result, route: logs[0].route, urlReads });
}
`;

const run = async (mode) => {
  const result = await execFileAsync(process.execPath, ['--input-type=module', '-e', child, mode], {
    cwd: repoRoot, maxBuffer: 1024 * 1024,
  });
  return JSON.parse(result.stdout.trim().split('\n').at(-1));
};

test('covers the defensive 500 path for unsent and already-sent responses', async () => {
  const unsent = await run('outer-unsent');
  assert.equal(unsent.status, 500);
  assert.deepEqual(JSON.parse(unsent.body), { error: 'Local API request failed.' });
  assert.equal(unsent.logs[0].level, 'error');
  const sent = await run('outer-sent');
  assert.equal(sent.destroyed, true);
  assert.equal(sent.body, undefined);
});

test('closes and reports a server with no TCP address or a string address', async () => {
  for (const mode of ['address-null', 'address-string']) {
    const result = await run(mode);
    assert.equal(result.message, 'Local API did not expose a TCP port.');
    assert.equal(result.closed, true);
  }
});

test('handles a request whose URL disappears between routing and payload execution', async () => {
  const result = await run('url-fallback');
  assert.equal(result.status, 200);
  assert.deepEqual(result.result, { fixture: 'audit' });
  assert.equal(result.route, 'unknown');
  assert.ok(result.urlReads >= 4);
});
