import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { startLocalApi } from '../dist/localApi.js';

const token = 'local-api-test-token-1234';
let api;

afterEach(async () => {
  if (api) {
    await api.close();
    api = undefined;
  }
});

const endpoint = (path) => `http://${api.host}:${api.port}${path}`;

test('keeps the local API loopback-only and requires bearer authentication', async () => {
  api = await startLocalApi({ token, audit: async () => ({ ok: true }) });

  const missing = await fetch(endpoint('/health'));
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), { error: 'Bearer authentication required.' });

  const healthy = await fetch(endpoint('/health'), {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(healthy.status, 200);
  assert.deepEqual(await healthy.json(), {
    ok: true,
    service: 'seomi-local-api',
    host: '127.0.0.1',
  });
});

test('runs a bounded audit through the authenticated JSON endpoint', async () => {
  let received;
  api = await startLocalApi({
    token,
    audit: async (...args) => {
      received = args;
      return { url: args[0], pages: [{ url: args[0], status: 200 }] };
    },
  });

  const response = await fetch(endpoint('/v1/audit'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      url: 'https://example.com/docs',
      timeout_ms: 2_000,
      scope_host: 'example.com',
      allow_subdomains: true,
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    result: {
      url: 'https://example.com/docs',
      pages: [{ url: 'https://example.com/docs', status: 200 }],
    },
  });
  assert.deepEqual(received, [
    'https://example.com/docs',
    2_000,
    { scopeHost: 'example.com', allowSubdomains: true },
  ]);
});

test('runs a bounded crawl through the authenticated JSON endpoint', async () => {
  let received;
  api = await startLocalApi({
    token,
    crawl: async (...args) => {
      received = args;
      return { requested_url: args[0], pages: [], errors: [], truncated: false };
    },
  });

  const response = await fetch(endpoint('/v1/crawl'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      start_url: 'https://example.com',
      timeout_ms: 3_000,
      max_pages: 8,
      max_depth: 2,
      scope_host: 'example.com',
      allow_subdomains: false,
      scope_path: '/docs',
      include_patterns: ['/docs*'],
      exclude_patterns: ['/docs/private/*'],
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    result: { requested_url: 'https://example.com', pages: [], errors: [], truncated: false },
  });
  assert.deepEqual(received, [
    'https://example.com',
    3_000,
    8,
    2,
    {
      scopeHost: 'example.com',
      allowSubdomains: false,
      scopePath: '/docs',
      includePatterns: ['/docs*'],
      excludePatterns: ['/docs/private/*'],
    },
  ]);
});

test('rejects invalid audit options before invoking the runner', async () => {
  let called = false;
  api = await startLocalApi({
    token,
    audit: async () => {
      called = true;
      return {};
    },
  });

  const response = await fetch(endpoint('/v1/audit'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url: 'https://example.com', timeout_ms: 50 }),
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /between 1000 and 30000/);
  assert.equal(called, false);
});

test('enforces the request body limit and route contract', async () => {
  api = await startLocalApi({ token, audit: async () => ({}) });
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const oversized = await fetch(endpoint('/v1/audit'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: 'https://example.com', padding: 'x'.repeat(70_000) }),
  });
  assert.equal(oversized.status, 413);

  const unknown = await fetch(endpoint('/v1/unknown'), { headers });
  assert.equal(unknown.status, 404);
  assert.match((await unknown.json()).error, /Route not found/);
});

const post = (path, body) => fetch(endpoint(path), { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('rejects coerced numeric fields before invoking audit or crawl', async () => {
  let calls = 0;
  api = await startLocalApi({ token, audit: async () => { calls++; return {}; }, crawl: async () => { calls++; return {}; } });
  for (const field of ['timeout_ms', 'max_pages', 'max_depth']) {
    for (const value of ['1000', true, false, null, [], {}]) {
      const response = await post('/v1/crawl', { start_url: 'https://example.com', [field]: value });
      assert.equal(response.status, 400, `${field}=${JSON.stringify(value)}`);
    }
  }
  assert.equal(calls, 0);
});

test('runner errors cannot leak secrets or control HTTP status', async () => {
  api = await startLocalApi({ token, audit: async () => { throw Object.assign(new Error('secret=private-token'), { statusCode: 200 }); } });
  const response = await post('/v1/audit', { url: 'https://example.com' });
  assert.equal(response.status, 422);
  const body = await response.text();
  assert.doesNotMatch(body, /private-token/);
  assert.match(body, /could not be completed/);
});

test('concurrency limit rejects excess work and releases slots after errors', { timeout: 5000 }, async () => {
  let release;
  let calls = 0;
  const started = new Promise((resolve) => { release = resolve; });
  api = await startLocalApi({ token, maxConcurrentRequests: 1, audit: async () => { calls++; await started; throw new Error('failure'); } });
  const first = post('/v1/audit', { url: 'https://example.com' });
  while (!calls) await new Promise((resolve) => setTimeout(resolve, 1));
  try {
    const blocked = await post('/v1/audit', { url: 'https://example.com' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '1');
    assert.equal(calls, 1);
    const health = await fetch(endpoint('/health'), { headers: { authorization: `Bearer ${token}` } });
    assert.equal(health.status, 200);
  } finally { release(); }
  assert.equal((await first).status, 422);
  assert.equal((await post('/v1/audit', { url: 'https://example.com' })).status, 422);
  assert.equal(calls, 2);
});

test('request correlation and structured logs omit tokens, bodies and unknown paths', async () => {
  const logs = [];
  api = await startLocalApi({ token, logger: (entry) => logs.push(entry), audit: async () => ({}) });
  const first = await post('/v1/audit', { url: 'https://example.com/secret-in-body' });
  const second = await fetch(endpoint('/unknown?secret-in-path'), { headers: { authorization: `Bearer ${token}`, 'x-request-id': 'untrusted-id' } });
  const firstId = first.headers.get('x-request-id');
  assert.match(firstId, /^[a-f0-9-]{36}$/);
  assert.notEqual(firstId, second.headers.get('x-request-id'));
  assert.notEqual(second.headers.get('x-request-id'), 'untrusted-id');
  await first.text(); await second.text();
  assert.equal(logs.length, 2);
  assert.equal(logs[0].request_id, firstId);
  assert.equal(logs[0].status, 200);
  assert.equal(logs[1].route, 'unknown');
  assert.equal(typeof logs[0].duration_ms, 'number');
  assert.doesNotMatch(JSON.stringify(logs), /local-api-test-token|secret-in-body|secret-in-path|untrusted-id/);
  assert.equal(api.server.headersTimeout, 10_000);
  assert.equal(api.server.requestTimeout, 30_000);
  assert.equal(api.server.keepAliveTimeout, 5_000);
});

test('invalid concurrency configuration fails before listening', async () => {
  for (const value of [0, 17, 1.5, '4']) {
    await assert.rejects(startLocalApi({ token, maxConcurrentRequests: value }), /concurrency/);
  }
});

test('logging failure cannot turn a completed request into a failure', async () => {
  api = await startLocalApi({ token, logger: () => { throw new Error('logger unavailable'); }, audit: async () => ({ status: 200 }) });
  const response = await post('/v1/audit', { url: 'https://example.com' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});
