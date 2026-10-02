import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { closeApi, endpoint, startApi, token } from './support/localApiHarness.mjs';

let api;
afterEach(closeApi);

test('keeps the local API loopback-only and requires bearer authentication', async () => {
  api = await startApi({ token, audit: async () => ({ ok: true }) });

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
  api = await startApi({
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
  api = await startApi({
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
  api = await startApi({
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
