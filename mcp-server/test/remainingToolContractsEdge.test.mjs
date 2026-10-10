import assert from 'node:assert/strict';
import test from 'node:test';
import { withClient } from './testHelpers.mjs';

const providers = {
  dataForSeo: async () => { throw 'string backlink failure'; },
  googleJson: async () => ({}),
  googlePublicJson: async () => ({}),
  googleApiKey: () => 'fixture',
};

test('backlink tools preserve non-Error provider failures', async () => {
  const cases = [
    ['seomi_research_backlinks', { target: 'example.com' }],
    ['seomi_research_backlink_anchors', { target: 'example.com' }],
    ['seomi_research_backlink_pages', { target: 'example.com' }],
    ['seomi_research_backlink_gap', { target: 'example.com', competitors: ['other.example.com'] }],
  ];
  await withClient({ providers }, async (client) => {
    for (const [name, arguments_] of cases) {
      const result = await client.callTool({ name, arguments: arguments_ });
      assert.equal(result.isError, true, name);
      assert.match(result.content[0].text, /string backlink failure/, name);
    }
  });
});

test('audit tools preserve non-Error runner failures', async () => {
  await withClient({
    audit: async () => { throw 'string audit failure'; },
    crawl: async () => { throw 'string crawl failure'; },
    providers,
  }, async (client) => {
    const audit = await client.callTool({ name: 'seomi_audit_url', arguments: { url: 'https://example.com' } });
    assert.equal(audit.isError, true);
    assert.match(audit.content[0].text, /string audit failure/);
    const crawl = await client.callTool({ name: 'seomi_crawl_site', arguments: { start_url: 'https://example.com' } });
    assert.equal(crawl.isError, true);
    assert.match(crawl.content[0].text, /string crawl failure/);
  });
});

test('server default public-target validation blocks private Google targets', async () => {
  let calls = 0;
  await withClient({
    providers: { ...providers, googlePublicJson: async () => { calls += 1; return {}; } },
  }, async (client) => {
    const result = await client.callTool({ name: 'seomi_pagespeed_insights', arguments: { url: 'http://127.0.0.1' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /private|loopback/i);
    assert.equal(calls, 0);
  });
});
