import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { startLocalApi } from '../dist/localApi.js';

const token = 'local-api-direct-contract-token';
let api;
afterEach(async () => {
  if (api) {
    await api.close();
    api = undefined;
  }
});
const endpoint = (port, path) => `http://127.0.0.1:${port}${path}`;
const post = (path, body) => globalThis.fetch(endpoint(api.port, path), {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

test('returns a usable handle, serves injected runners, and closes its listener', async () => {
  const calls = [];
  api = await startLocalApi({
    token,
    audit: async (...args) => { calls.push(['audit', ...args]); return { fixture: 'audit' }; },
    logger: () => {},
  });
  assert.equal(api.host, '127.0.0.1');
  assert.ok(Number.isInteger(api.port) && api.port > 0);
  const health = await globalThis.fetch(endpoint(api.port, '/health'), { headers: { authorization: `Bearer ${token}` } });
  assert.equal(health.status, 200);
  const result = await post('/v1/audit', { url: 'https://example.test/page', timeout_ms: 1_000 });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true, result: { fixture: 'audit' } });
  assert.deepEqual(calls, [['audit', 'https://example.test/page', 1_000, { scopeHost: undefined, allowSubdomains: undefined }]]);
  const port = api.port;
  await api.close();
  api = undefined;
  await assert.rejects(globalThis.fetch(endpoint(port, '/health')), /fetch failed/);
});

test('maps injected audit and crawl failures to safe 422 responses', async () => {
  const logs = [];
  api = await startLocalApi({
    token,
    audit: async () => { throw new Error('secret audit diagnostic'); },
    crawl: async () => { throw new Error('secret crawl diagnostic'); },
    logger: (entry) => logs.push(entry),
  });
  const audit = await post('/v1/audit', { url: 'https://example.test/audit' });
  const crawl = await post('/v1/crawl', { start_url: 'https://example.test' });
  for (const result of [audit, crawl]) {
    assert.equal(result.status, 422);
    const body = await result.text();
    assert.match(body, /could not be completed/);
    assert.doesNotMatch(body, /secret (audit|crawl) diagnostic/);
  }
  assert.deepEqual(logs.map(({ route, status, method }) => ({ route, status, method })), [
    { route: '/v1/audit', status: 422, method: 'POST' },
    { route: '/v1/crawl', status: 422, method: 'POST' },
  ]);
});

test('rejects invalid startup options before creating a listener', async () => {
  await assert.rejects(startLocalApi({ token: 'too-short' }), /at least 16/);
  await assert.rejects(startLocalApi({ token, port: 65_536 }), /port/);
  await assert.rejects(startLocalApi({ token, port: 1.5 }), /port/);
});

test('records OTHER methods and rejects operation routes outside POST', async () => {
  const logs = [];
  api = await startLocalApi({ token, logger: (entry) => logs.push(entry), audit: async () => ({}) });
  const result = await globalThis.fetch(endpoint(api.port, '/v1/audit'), {
    method: 'PUT', headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(result.status, 404);
  assert.equal(result.headers.get('allow'), 'GET, POST');
  assert.match((await result.json()).error, /Route not found/);
  assert.deepEqual(logs.map(({ method, route, status }) => ({ method, route, status })), [
    { method: 'OTHER', route: '/v1/audit', status: 404 },
  ]);
});

test('rejects a listener collision while preserving the original running handle', async () => {
  api = await startLocalApi({ token, audit: async () => ({}), logger: () => {} });
  await assert.rejects(startLocalApi({ token, port: api.port }), /EADDRINUSE|address already in use/i);
  const health = await globalThis.fetch(endpoint(api.port, '/health'), { headers: { authorization: `Bearer ${token}` } });
  assert.equal(health.status, 200);
});

test('starts with default runners and propagates a repeated close error', async () => {
  api = await startLocalApi({ token, logger: () => {} });
  const handle = api;
  await api.close();
  api = undefined;
  await assert.rejects(handle.close(), /not running|ERR_SERVER_NOT_RUNNING/i);
});
