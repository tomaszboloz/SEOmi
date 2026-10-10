import assert from 'node:assert/strict';
import test from 'node:test';
import { withClient } from './testHelpers.mjs';

const failingResearchCases = [
  ['seomi_research_keywords', { keyword: 'seo' }],
  ['seomi_research_keyword_suggestions', { seed: 'seo' }],
  ['seomi_research_serp', { keyword: 'seo' }],
  ['seomi_track_rank', { keyword: 'seo', target: 'example.com' }],
  ['seomi_research_domain_overview', { target: 'example.com' }],
  ['seomi_research_top_pages', { target: 'example.com' }],
  ['seomi_research_ranked_keywords', { target: 'example.com' }],
  ['seomi_research_domain_competitors', { target: 'example.com' }],
];

test('research tools preserve non-Error provider failures as safe MCP errors', async () => {
  await withClient({ providers: { dataForSeo: async () => { throw 'string provider failure'; } } }, async (client) => {
    for (const [name, arguments_] of failingResearchCases) {
      const result = await client.callTool({ name, arguments: arguments_ });
      assert.equal(result.isError, true, name);
      assert.match(result.content[0].text, /string provider failure/);
    }
  });
});

test('track rank handles protocol targets, malformed rows, domains, and empty candidates', async () => {
  let call = 0;
  await withClient({ providers: { dataForSeo: async () => call++ === 0 ? {
    result: [null, { items: 'invalid' }, { items: [
      { domain: 'example.com' }, {}, { url: 'https://www.example.com/page' },
    ] }],
  } : { result: null } } }, async (client) => {
    const matched = await client.callTool({ name: 'seomi_track_rank', arguments: {
      keyword: 'seo', target: 'https://example.com/path',
    } });
    assert.equal(matched.isError, false);
    assert.equal(matched.structuredContent.target_host, 'example.com');
    assert.equal(matched.structuredContent.matches.length, 2);
    const empty = await client.callTool({ name: 'seomi_track_rank', arguments: {
      keyword: 'seo', target: 'example.com',
    } });
    assert.equal(empty.isError, false);
    assert.deepEqual(empty.structuredContent.matches, []);
  });
});
