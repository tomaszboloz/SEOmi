import assert from 'node:assert/strict';
import test from 'node:test';
import { withClient } from './testHelpers.mjs';

test('PageSpeed keeps sparse Lighthouse metadata explicit', async () => {
  await withClient({
    publicTarget: async (url) => url,
    providers: {
      googleApiKey: () => 'fixture',
      googlePublicJson: async () => ({ lighthouseResult: { audits: {} } }),
    },
  }, async (client) => {
    const result = await client.callTool({
      name: 'seomi_pagespeed_insights', arguments: { url: 'https://example.com' },
    });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.lighthouse_version, null);
    assert.equal(result.structuredContent.fetch_time, null);
    assert.equal(result.structuredContent.categories, null);
    assert.deepEqual(result.structuredContent.audits, {});
  });
});

test('Google tools preserve non-Error provider failures as safe MCP errors', async () => {
  await withClient({
    publicTarget: async (url) => url,
    providers: {
      googleApiKey: () => 'fixture',
      googlePublicJson: async () => { throw 'public Google failure'; },
      googleJson: async () => { throw 'authenticated Google failure'; },
    },
  }, async (client) => {
    const calls = [
      ['seomi_pagespeed_insights', { url: 'https://example.com' }, /public Google failure/],
      ['seomi_crux', { url: 'https://example.com' }, /public Google failure/],
      ['seomi_gsc_search_analytics', {
        site_url: 'sc-domain:example.com', start_date: '2026-01-01', end_date: '2026-01-31',
      }, /authenticated Google failure/],
      ['seomi_gsc_url_inspection', {
        inspection_url: 'https://example.com', site_url: 'sc-domain:example.com',
      }, /authenticated Google failure/],
    ];
    for (const [name, arguments_, message] of calls) {
      const result = await client.callTool({ name, arguments: arguments_ });
      assert.equal(result.isError, true, name);
      assert.match(result.content[0].text, message, name);
    }
  });
});
