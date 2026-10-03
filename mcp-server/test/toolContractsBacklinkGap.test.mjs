import assert from 'node:assert/strict';
import test from 'node:test';
import { withClient } from './testHelpers.mjs';

test('backlink gap deduplicates competitors and rejects a self-only comparison', async () => {
  let received;
  await withClient({ providers: { dataForSeo: async (...args) => { received = args; return { status_code: 20000 }; } } }, async (client) => {
    const result = await client.callTool({
      name: 'seomi_research_backlink_gap',
      arguments: {
        target: 'https://www.example.com/path',
        competitors: ['example.com', 'https://www.other.com/path', 'OTHER.COM'],
      },
    });
    assert.equal(result.isError, false);
    assert.equal(received[0], '/v3/backlinks/domain_intersection/live');
    assert.deepEqual(received[1][0].targets, { '1': 'other.com' });
    assert.deepEqual(received[1][0].exclude_targets, ['example.com']);
    const rejected = await client.callTool({
      name: 'seomi_research_backlink_gap',
      arguments: { target: 'example.com', competitors: ['www.example.com'] },
    });
    assert.equal(rejected.isError, true);
  });
});

test('PageSpeed returns selected evidence while excluding unrelated audit payloads', async () => {
  await withClient({
    publicTarget: async (url) => url,
    providers: {
      googleApiKey: () => 'fixture',
      googlePublicJson: async () => ({
        lighthouseResult: {
          lighthouseVersion: 'fixture-version',
          categories: { performance: { score: 0.9 } },
          audits: {
            'largest-contentful-paint': { numericValue: 2300 },
            unrelated: { details: 'large result' },
          },
        },
      }),
    },
  }, async (client) => {
    const result = await client.callTool({ name: 'seomi_pagespeed_insights', arguments: { url: 'https://example.com' } });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.audits['largest-contentful-paint'].numericValue, 2300);
    assert.equal(result.structuredContent.audits.unrelated, undefined);
    assert.equal(result.structuredContent.lighthouse_version, 'fixture-version');
  });
});

test('public target validation failures stop Google performance transport', async () => {
  let calls = 0;
  await withClient({
    publicTarget: async () => { throw new Error('private target rejected'); },
    providers: {
      googleApiKey: () => 'fixture',
      googlePublicJson: async () => { calls++; return {}; },
    },
  }, async (client) => {
    for (const name of ['seomi_crux', 'seomi_pagespeed_insights']) {
      const result = await client.callTool({ name, arguments: { url: 'http://127.0.0.1' } });
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /private target rejected/);
    }
    assert.equal(calls, 0);
  });
});

test('backlink gap normalizes ports, trailing dots and IDN before calling the provider', async () => {
  const requests = [];
  await withClient({ providers: { dataForSeo: async (endpoint, body) => { requests.push({ endpoint, body }); return {}; } } }, async (client) => {
    const result = await client.callTool({
      name: 'seomi_research_backlink_gap',
      arguments: {
        target: 'https://WWW.Example.com.:443/path?query=1',
        competitors: ['https://www.bücher.de:8443/path', 'xn--bcher-kva.de'],
      },
    });
    assert.equal(result.isError, false);
    assert.deepEqual(requests[0].body[0].targets, { '1': 'xn--bcher-kva.de' });
    assert.deepEqual(requests[0].body[0].exclude_targets, ['example.com']);
  });
});

for (const target of ['https://user:secret@example.com', 'ftp://example.com', 'localhost', 'https://[broken']) {
  test(`backlink gap rejects invalid target before provider: ${target}`, async () => {
    let calls = 0;
    await withClient({ providers: { dataForSeo: async () => { calls++; return {}; } } }, async (client) => {
      const result = await client.callTool({ name: 'seomi_research_backlink_gap', arguments: { target, competitors: ['other.example'] } });
      assert.equal(result.isError, true);
      assert.equal(calls, 0);
      assert.equal(JSON.stringify(result).includes('secret'), false);
    });
  });
}
