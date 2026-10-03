import assert from 'node:assert/strict';
import test from 'node:test';
import { createProviderClient, readProviderJson } from '../dist/providers.js';

const env = { DATAFORSEO_LOGIN: 'fixture', DATAFORSEO_PASSWORD: 'fixture', GOOGLE_ACCESS_TOKEN: 'fixture', GOOGLE_API_KEY: 'fixture' };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('provider JSON accepts exact bounds and cancels overflow before parsing', async () => {
  assert.deepEqual(await readProviderJson(new Response('{}'), 2), {});
  await assert.rejects(readProviderJson(new Response('{"x":1}'), 2), /size limit/);
  for (const body of ['[]', 'null', '42', 'invalid']) {
    await assert.rejects(readProviderJson(new Response(body), 32), /JSON object/);
  }
});

test('credentials are required before invoking any transport', async () => {
  let calls = 0;
  const client = createProviderClient({ env: {}, fetch: async () => { calls++; return response({}); } });
  await assert.rejects(client.dataForSeo('/v3/test', []), /DATAFORSEO_LOGIN/);
  await assert.rejects(client.googleJson('https://google.test', {}), /GOOGLE_ACCESS_TOKEN/);
  assert.throws(client.googleApiKey, /GOOGLE_API_KEY/);
  assert.equal(calls, 0);
});

test('DataForSEO contract preserves requests and validates the provider task', async () => {
  let request;
  const client = createProviderClient({ env, fetch: async (...args) => { request = args; return response({ tasks: [{ status_code: 20000, result: [] }] }); } });
  assert.deepEqual(await client.dataForSeo('/v3/test', [{ keyword: 'seo' }]), { status_code: 20000, result: [] });
  assert.equal(request[0], 'https://api.dataforseo.com/v3/test');
  assert.equal(request[1].redirect, 'error');
  assert.equal(request[1].method, 'POST');
  assert.deepEqual(JSON.parse(request[1].body), [{ keyword: 'seo' }]);
  assert.match(request[1].headers.authorization, /^Basic /);
  for (const body of [{}, { tasks: [{}] }, { tasks: [null] }, { tasks: [{ status_code: 40000, status_message: 'secret echoed by provider' }] }]) {
    const failed = createProviderClient({ env, fetch: async () => response(body) });
    await assert.rejects(failed.dataForSeo('/v3/test', []), /DataForSEO/);
  }
});

test('Google transports preserve method, auth and bounded JSON', async () => {
  for (const method of ['googleJson', 'googlePublicJson']) {
    let request;
    const client = createProviderClient({ env, fetch: async (...args) => { request = args; return response({ record: { key: 'value' } }); } });
    assert.deepEqual(await client[method]('https://google.test', { method: 'POST', body: '{}' }), { record: { key: 'value' } });
    assert.equal(request[1].redirect, 'error');
    assert.equal(request[1].method, 'POST');
    assert.equal(request[1].body, '{}');
    if (method === 'googleJson') assert.equal(request[1].headers.authorization, 'Bearer fixture');
    else assert.equal(request[1].headers.authorization, undefined);
  }
});

test('all provider transports expose safe HTTP errors and network failures', async () => {
  for (const method of ['dataForSeo', 'googleJson', 'googlePublicJson']) {
    const failed = createProviderClient({ env, fetch: async () => response({ error: { message: 'secret from provider' } }, 403) });
    await assert.rejects(failed[method]('/v3/test', []), (error) => /HTTP 403/.test(error.message) && !error.message.includes('secret'));
    const offline = createProviderClient({ env, fetch: async () => { throw new Error('offline'); } });
    await assert.rejects(offline[method]('/v3/test', []), /offline/);
  }
});

test('Google keys validate limits and support PageSpeed fallback', () => {
  const client = createProviderClient({ env: { GOOGLE_PAGESPEED_API_KEY: ' fallback ' } });
  assert.equal(client.googleApiKey(), 'fallback');
  for (const key of ['x'.repeat(257), 'bad\\nkey'.replace('\\n', '\n')]) {
    assert.throws(createProviderClient({ env: { GOOGLE_API_KEY: key } }).googleApiKey, /invalid/);
  }
});
