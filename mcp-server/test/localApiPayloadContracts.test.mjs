import assert from 'node:assert/strict';
import test from 'node:test';
import { executeApiPayload } from '../dist/localApiPayload.js';
import { LocalApiError } from '../dist/localApiHttp.js';
import { DEFAULT_AUDIT_TIMEOUT_MS } from '../dist/auditWorkflow.js';

test('public payload executor dispatches exact audit/crawl arguments and returns runner results', async () => {
  const calls = [];
  const auditResult = { url: 'https://example.test/', kind: 'audit fixture' };
  const crawlResult = { start_url: 'https://example.test/', kind: 'crawl fixture' };
  const audit = async (...args) => { calls.push(['audit', ...args]); return auditResult; };
  const crawl = async (...args) => { calls.push(['crawl', ...args]); return crawlResult; };
  assert.equal(await executeApiPayload({ url: 'https://example.test/' }, '/v1/audit', audit, crawl), auditResult);
  assert.deepEqual(calls.pop(), ['audit', 'https://example.test/', DEFAULT_AUDIT_TIMEOUT_MS, { scopeHost: undefined, allowSubdomains: undefined }]);
  assert.equal(await executeApiPayload({ start_url: 'https://example.test/' }, '/v1/crawl', audit, crawl), crawlResult);
  assert.deepEqual(calls.pop(), ['crawl', 'https://example.test/', DEFAULT_AUDIT_TIMEOUT_MS, 25, 3, { scopeHost: undefined, allowSubdomains: undefined }]);
  const payload = { start_url: 'https://example.test/blog', timeout_ms: 1000, max_pages: 100, max_depth: 0,
    scope_host: 'example.test', allow_subdomains: true, scope_path: '/blog', include_patterns: ['/blog/*'], exclude_patterns: ['/blog/private*'] };
  assert.equal(await executeApiPayload(payload, '/v1/crawl', audit, crawl), crawlResult);
  assert.deepEqual(calls.pop(), ['crawl', payload.start_url, 1000, 100, 0, { scopeHost: 'example.test', allowSubdomains: true,
    scopePath: '/blog', includePatterns: ['/blog/*'], excludePatterns: ['/blog/private*'] }]);
  assert.equal(await executeApiPayload({ start_url: payload.start_url, timeout_ms: 30000, max_pages: 1, max_depth: 10 }, '/v1/crawl', audit, crawl), crawlResult);
  assert.deepEqual(calls.pop().slice(1, 5), [payload.start_url, 30000, 1, 10]);
});

test('public payload executor rejects malformed/type-coerced input before either runner is invoked', async () => {
  let called = false;
  const runner = async () => { called = true; throw new Error('must not invoke runner'); };
  const invalid = [null, false, 42, [], 'json', {}, { url: '' }, { url: 42 },
    ...[999, 30001, 1000.5, '1000', true].map(timeout_ms => ({ url: 'https://example.test/', timeout_ms })),
    { url: 'https://example.test/', scope_host: 42 }, { url: 'https://example.test/', allow_subdomains: 'true' },
    { url: 'https://example.test/', scope_path: 42 }, { url: 'https://example.test/', scope_path: '/'.repeat(2049) },
  ];
  for (const field of ['include_patterns', 'exclude_patterns']) {
    for (const value of ['/*', [42], Array(21).fill('/*'), ['x'.repeat(201)], ['/x\0']]) {
      invalid.push({ url: 'https://example.test/', [field]: value });
    }
  }
  for (const payload of invalid) {
    await assert.rejects(executeApiPayload(payload, '/v1/audit', runner, runner), (error) => error instanceof LocalApiError && error.statusCode === 400);
  }
  assert.equal(called, false);
  for (const field of ['max_pages', 'max_depth']) {
    const values = field === 'max_pages' ? [0, 101, 1.5, '1', false] : [-1, 11, 0.5, '0', false];
    for (const value of values) {
      await assert.rejects(executeApiPayload({ start_url: 'https://example.test/', [field]: value }, '/v1/crawl', runner, runner),
        (error) => error instanceof LocalApiError && error.statusCode === 400);
    }
  }
  await assert.rejects(executeApiPayload({ url: 'https://example.test/' }, '/v1/crawl', runner, runner), /start_url/);
  assert.equal(called, false);
});

test('public payload executor preserves runner failure identity without converting it to success', async () => {
  const failure = new Error('fixture runner failure');
  const runner = async () => { throw failure; };
  await assert.rejects(executeApiPayload({ url: 'https://example.test/' }, '/v1/audit', runner, runner), (error) => error === failure);
  await assert.rejects(executeApiPayload({ start_url: 'https://example.test/' }, '/v1/crawl', runner, runner), (error) => error === failure);
});
