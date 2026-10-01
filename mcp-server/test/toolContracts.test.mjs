import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createSeoMiServer } from '../dist/server.js';

const cases = [
  ['seomi_audit_url', { url: 'https://example.com' }, 'audit'],
  ['seomi_crawl_site', { start_url: 'https://example.com' }, 'crawl'],
  ['seomi_crux', { url: 'https://example.com' }, 'googlePublicJson'],
  ['seomi_pagespeed_insights', { url: 'https://example.com' }, 'googlePublicJson'],
  ['seomi_gsc_search_analytics', { site_url: 'sc-domain:example.com', start_date: '2026-01-01', end_date: '2026-01-31' }, 'googleJson'],
  ['seomi_gsc_url_inspection', { inspection_url: 'https://example.com', site_url: 'sc-domain:example.com' }, 'googleJson'],
  ['seomi_research_backlink_anchors', { target: 'example.com' }, 'dataForSeo'],
  ['seomi_research_backlink_gap', { target: 'example.com', competitors: ['other.example.com'] }, 'dataForSeo'],
  ['seomi_research_backlink_pages', { target: 'example.com' }, 'dataForSeo'],
  ['seomi_research_backlinks', { target: 'example.com' }, 'dataForSeo'],
  ['seomi_research_domain_competitors', { target: 'example.com' }, 'dataForSeo'],
  ['seomi_research_domain_overview', { target: 'example.com' }, 'dataForSeo'],
  ['seomi_research_keyword_suggestions', { seed: 'seo' }, 'dataForSeo'],
  ['seomi_research_keywords', { keyword: 'seo' }, 'dataForSeo'],
  ['seomi_research_ranked_keywords', { target: 'example.com' }, 'dataForSeo'],
  ['seomi_research_serp', { keyword: 'seo' }, 'dataForSeo'],
  ['seomi_research_top_pages', { target: 'example.com' }, 'dataForSeo'],
  ['seomi_track_rank', { keyword: 'seo', target: 'example.com' }, 'dataForSeo'],
];

const withClient = async (dependencies, run) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createSeoMiServer(dependencies);
  const client = new Client({ name: 'contract-fixture', version: '1.0.0' });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await run(client);
  } finally { await client.close(); await server.close(); }
};

for (const [name, input, expectedRunner] of cases) {
  test(`${name}: happy/error/schema contract over MCP`, async () => {
    const calls = [];
    const runner = (kind) => async (...args) => { calls.push([kind, ...args]); return { status_code: 20000, result: [{ items: [{ url: 'https://example.com/page' }] }] }; };
    const dependencies = {
      audit: runner('audit'), crawl: runner('crawl'), publicTarget: async (url) => url,
      providers: { dataForSeo: runner('dataForSeo'), googleJson: runner('googleJson'), googlePublicJson: runner('googlePublicJson'), googleApiKey: () => 'fixture' },
    };
    await withClient(dependencies, async (client) => {
      const result = await client.callTool({ name, arguments: input });
      assert.equal(result.isError, false);
      assert.equal(calls.length, 1);
      assert.equal(calls[0][0], expectedRunner);
      assert.ok(result.structuredContent);
      if (expectedRunner === 'dataForSeo') {
        assert.match(calls[0][1], /^\/v3\/(backlinks|keywords_data|serp|dataforseo_labs)\//);
        assert.equal(calls[0][2].length, 1);
        assert.equal(typeof calls[0][2][0], 'object');
        if ('keyword' in input && name !== 'seomi_track_rank') {
          const task = calls[0][2][0];
          assert.ok(task.keyword === input.keyword || task.keywords?.[0] === input.keyword);
          assert.equal(task.location_code, 2840);
          assert.equal(task.language_code, 'en');
        }
      }
      if (name === 'seomi_track_rank') assert.equal(result.structuredContent.matches.length, 1);
      if (name === 'seomi_gsc_search_analytics') {
        const body = JSON.parse(calls[0][2].body);
        assert.equal(body.startDate, input.start_date);
        assert.equal(body.endDate, input.end_date);
        assert.equal(body.rowLimit, 1000);
      }
      const invalid = await client.callTool({ name, arguments: {} });
      assert.equal(invalid.isError, true);
      assert.equal(calls.length, 1, 'invalid input must never invoke the provider');
      const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
      assert.equal(client.getServerVersion().version, packageJson.version);
    });
    const failed = async () => { throw new Error('fixture unavailable'); };
    await withClient({
      audit: failed, crawl: failed, publicTarget: async (url) => url,
      providers: { dataForSeo: failed, googleJson: failed, googlePublicJson: failed, googleApiKey: () => 'fixture' },
    }, async (client) => {
      const result = await client.callTool({ name, arguments: input });
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /fixture unavailable/);
    });
  });
}

test('backlink gap deduplicates competitors and rejects a self-only comparison', async () => {
  let received;
  await withClient({ providers: { dataForSeo: async (...args) => { received = args; return { status_code: 20000 }; } } }, async (client) => {
    const result = await client.callTool({ name: 'seomi_research_backlink_gap', arguments: {
      target: 'https://www.example.com/path', competitors: ['example.com', 'https://www.other.com/path', 'OTHER.COM'],
    } });
    assert.equal(result.isError, false);
    assert.equal(received[0], '/v3/backlinks/domain_intersection/live');
    assert.deepEqual(received[1][0].targets, { '1': 'other.com' });
    assert.deepEqual(received[1][0].exclude_targets, ['example.com']);
    const rejected = await client.callTool({ name: 'seomi_research_backlink_gap', arguments: { target: 'example.com', competitors: ['www.example.com'] } });
    assert.equal(rejected.isError, true);
  });
});

test('PageSpeed returns selected evidence while excluding unrelated audit payloads', async () => {
  await withClient({ publicTarget: async (url) => url, providers: {
    googleApiKey: () => 'fixture', googlePublicJson: async () => ({ lighthouseResult: {
      lighthouseVersion: 'fixture-version', categories: { performance: { score: 0.9 } },
      audits: { 'largest-contentful-paint': { numericValue: 2300 }, unrelated: { details: 'large result' } },
    } }),
  } }, async (client) => {
    const result = await client.callTool({ name: 'seomi_pagespeed_insights', arguments: { url: 'https://example.com' } });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.audits['largest-contentful-paint'].numericValue, 2300);
    assert.equal(result.structuredContent.audits.unrelated, undefined);
    assert.equal(result.structuredContent.lighthouse_version, 'fixture-version');
  });
});

test('public target validation failures stop Google performance transport', async () => {
  let calls = 0;
  await withClient({ publicTarget: async () => { throw new Error('private target rejected'); }, providers: {
    googleApiKey: () => 'fixture', googlePublicJson: async () => { calls++; return {}; },
  } }, async (client) => {
    for (const name of ['seomi_crux', 'seomi_pagespeed_insights']) {
      const result = await client.callTool({ name, arguments: { url: 'http://127.0.0.1' } });
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /private target rejected/);
    }
    assert.equal(calls, 0);
  });
});
