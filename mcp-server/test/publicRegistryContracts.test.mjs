import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { registerAuditTools } from '../dist/toolsAudit.js';
import { registerBacklinkTools } from '../dist/toolsBacklinks.js';
import { registerGoogleTools } from '../dist/toolsGoogle.js';
import { registerResearchTools } from '../dist/toolsResearch.js';

const registry = () => {
  const tools = new Map();
  return { tools, registerTool: (name, config, handler) => tools.set(name, { name, ...config, handler }) };
};

const assertSchemas = (tools, expected) => {
  assert.deepEqual([...tools.keys()].sort(), Object.keys(expected).sort());
  for (const [name, keys] of Object.entries(expected)) {
    const tool = tools.get(name);
    assert.equal(typeof tool.handler, 'function', `${name} handler`);
    assert.ok(tool.title && tool.description, `${name} metadata`);
    assert.deepEqual(Object.keys(tool.inputSchema).sort(), keys.sort(), `${name} schema keys`);
    assert.equal(z.object(tool.inputSchema).safeParse({}).success, false, `${name} required fields`);
  }
};

const run = async (tool, input) => {
  const result = await tool.handler(input);
  assert.equal(result.isError, false);
  assert.ok(result.structuredContent);
  return result.structuredContent;
};

test('audit and backlink registries expose schemas and invoke supplied dependencies', async () => {
  const auditCalls = [];
  const auditRegistry = registry();
  registerAuditTools(auditRegistry, async (...args) => { auditCalls.push(['audit', args]); return { kind: 'audit' }; }, async (...args) => { auditCalls.push(['crawl', args]); return { kind: 'crawl' }; });
  assertSchemas(auditRegistry.tools, {
    seomi_audit_url: ['url', 'timeout_ms', 'scope_host', 'allow_subdomains', 'scope_path', 'include_patterns', 'exclude_patterns'],
    seomi_crawl_site: ['start_url', 'max_pages', 'max_depth', 'timeout_ms', 'scope_host', 'allow_subdomains', 'scope_path', 'include_patterns', 'exclude_patterns'],
  });
  assert.deepEqual(await run(auditRegistry.tools.get('seomi_audit_url'), { url: 'https://example.test', timeout_ms: 1200, allow_subdomains: true, include_patterns: [], exclude_patterns: [] }), { kind: 'audit' });
  assert.deepEqual(await run(auditRegistry.tools.get('seomi_crawl_site'), { start_url: 'https://example.test', max_pages: 2, max_depth: 1, timeout_ms: 1200, allow_subdomains: false, include_patterns: [], exclude_patterns: [] }), { kind: 'crawl' });
  assert.equal(auditCalls.length, 2);
  assert.equal(auditCalls[0][1][1], 1200);

  const backlinkCalls = [];
  const backlinkRegistry = registry();
  const dataForSeo = async (path, payload) => { backlinkCalls.push([path, payload]); return { path }; };
  registerBacklinkTools(backlinkRegistry, dataForSeo);
  assertSchemas(backlinkRegistry.tools, {
    seomi_research_backlinks: ['target'], seomi_research_backlink_anchors: ['target', 'offset', 'limit'],
    seomi_research_backlink_pages: ['target', 'offset', 'limit'], seomi_research_backlink_gap: ['target', 'competitors', 'include_subdomains', 'offset', 'limit'],
  });
  await run(backlinkRegistry.tools.get('seomi_research_backlinks'), { target: 'example.test' });
  await run(backlinkRegistry.tools.get('seomi_research_backlink_anchors'), { target: 'example.test', offset: 1, limit: 2 });
  await run(backlinkRegistry.tools.get('seomi_research_backlink_pages'), { target: 'example.test', offset: 1, limit: 2 });
  await run(backlinkRegistry.tools.get('seomi_research_backlink_gap'), { target: 'https://example.test', competitors: ['https://other.test'], include_subdomains: true, offset: 1, limit: 2 });
  assert.deepEqual(backlinkCalls.map(([path]) => path), ['/v3/backlinks/summary/live', '/v3/backlinks/anchors/live', '/v3/backlinks/backlinks/live', '/v3/backlinks/domain_intersection/live']);
  assert.deepEqual(backlinkCalls[3][1][0].exclude_targets, ['example.test']);
});

test('Google registry preserves provider request contracts and response shaping', async () => {
  const calls = [];
  const googleRegistry = registry();
  const ctx = {
    googleApiKey: () => 'fixture-key',
    publicTargetUrl: async (url) => { calls.push(['target', url]); return 'https://public.example/'; },
    googlePublicJson: async (...args) => { calls.push(['public', ...args]); return { lighthouseResult: { lighthouseVersion: 'fixture', audits: { 'document-title': { score: 1 }, unrelated: {} } } }; },
    googleJson: async (...args) => { calls.push(['private', ...args]); return { rows: [] }; },
  };
  registerGoogleTools(googleRegistry, ctx);
  assertSchemas(googleRegistry.tools, {
    seomi_pagespeed_insights: ['url', 'strategy', 'categories'], seomi_crux: ['url', 'form_factor'],
    seomi_gsc_search_analytics: ['site_url', 'start_date', 'end_date', 'dimensions', 'type', 'row_limit', 'start_row'],
    seomi_gsc_url_inspection: ['inspection_url', 'site_url', 'language_code'],
  });
  const pageSpeed = await run(googleRegistry.tools.get('seomi_pagespeed_insights'), { url: 'https://example.test', strategy: 'desktop', categories: ['seo'] });
  assert.equal(pageSpeed.requested_url, 'https://public.example/');
  assert.deepEqual(Object.keys(pageSpeed.audits), ['document-title']);
  await run(googleRegistry.tools.get('seomi_crux'), { url: 'https://example.test', form_factor: 'DESKTOP' });
  await run(googleRegistry.tools.get('seomi_gsc_search_analytics'), { site_url: 'sc-domain:example.test', start_date: '2026-01-01', end_date: '2026-01-02', dimensions: ['query'], type: 'web', row_limit: 2, start_row: 1 });
  await run(googleRegistry.tools.get('seomi_gsc_url_inspection'), { inspection_url: 'https://example.test/page', site_url: 'sc-domain:example.test', language_code: 'en-US' });
  assert.equal(calls.filter(([kind]) => kind === 'target').length, 2);
  const request = calls.find(([kind]) => kind === 'private');
  assert.ok(request);
  assert.equal(JSON.parse(request[2].body).rowLimit, 2);
});

test('research registry registers every provider path and tracks rank results', async () => {
  const calls = [];
  const tools = registry();
  const dataForSeo = async (path, payload) => { calls.push([path, payload]); return path.includes('/serp/') ? { result: [{ items: [{ url: 'https://example.test/page' }] }] } : { path }; };
  registerResearchTools(tools, dataForSeo);
  assertSchemas(tools.tools, {
    seomi_research_keywords: ['keyword', 'location_code', 'language_code'], seomi_research_keyword_suggestions: ['seed', 'location_code', 'language_code'],
    seomi_research_serp: ['keyword', 'location_code', 'language_code', 'depth'], seomi_track_rank: ['keyword', 'target', 'location_code', 'language_code', 'depth'],
    seomi_research_domain_overview: ['target', 'location_code', 'language_code'], seomi_research_top_pages: ['target', 'location_code', 'language_code', 'limit'],
    seomi_research_ranked_keywords: ['target', 'location_code', 'language_code', 'limit'], seomi_research_domain_competitors: ['target', 'location_code', 'language_code', 'limit'],
  });
  for (const [name, input] of [
    ['seomi_research_keywords', { keyword: 'seo', location_code: 616, language_code: 'pl' }], ['seomi_research_keyword_suggestions', { seed: 'seo', location_code: 616, language_code: 'pl' }],
    ['seomi_research_serp', { keyword: 'seo', location_code: 616, language_code: 'pl', depth: 10 }], ['seomi_track_rank', { keyword: 'seo', target: 'example.test', location_code: 616, language_code: 'pl', depth: 10 }],
    ['seomi_research_domain_overview', { target: 'example.test', location_code: 616, language_code: 'pl' }], ['seomi_research_top_pages', { target: 'example.test', location_code: 616, language_code: 'pl', limit: 2 }],
    ['seomi_research_ranked_keywords', { target: 'example.test', location_code: 616, language_code: 'pl', limit: 2 }], ['seomi_research_domain_competitors', { target: 'example.test', location_code: 616, language_code: 'pl', limit: 2 }],
  ]) { const result = await run(tools.tools.get(name), input); if (name === 'seomi_track_rank') assert.equal(result.matches.length, 1); }
  assert.equal(calls.length, 8);
  assert.equal(calls[0][1][0].location_code, 616);
});
