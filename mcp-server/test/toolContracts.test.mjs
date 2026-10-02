import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { withClient } from './support/mcpClient.mjs';

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
