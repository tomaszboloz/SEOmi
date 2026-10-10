import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { URL } from 'node:url';
import { withClient } from './testHelpers.mjs';
import { ledgerPath, recordMcpCost } from '../dist/dataForSeoBudget.js';
import { extractSemanticSignals } from '../dist/auditSemantic.js';
import { startLocalApi } from '../dist/localApi.js';

test('semantic extraction strips empty-attribute and hidden blocks from body content', () => {
  const result = extractSemanticSignals(
    '<main><p>Visible phrase</p><div hidden>secret phrase</div></main>',
    new URL('https://example.com/'),
  );
  assert.equal(result.source, 'primary-root');
  assert.deepEqual(result.terms, ['phrase', 'visible']);
});

test('budget helpers use the safe default ledger and normalize invalid costs', () => {
  assert.match(ledgerPath({ DATAFORSEO_LEDGER_PATH: '  ' }), /\.seomi[\\/]mcp-dataforseo-spend\.json$/);
  const directory = mkdtempSync(join(tmpdir(), 'seomi-budget-edge-'));
  const env = {
    DATAFORSEO_MONTHLY_LIMIT_USD: '5',
    DATAFORSEO_LEDGER_PATH: join(directory, 'ledger.json'),
  };
  try {
    assert.deepEqual(recordMcpCost(env, 'not-a-cost', new Date(2026, 9, 1)), {
      month: '2026-10', totalUsd: 0, calls: 1,
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('server default public-target validation accepts a public IP for Google tools', async () => {
  await withClient({
    providers: {
      googleApiKey: () => 'fixture',
      googlePublicJson: async () => ({}),
    },
  }, async (client) => {
    const result = await client.callTool({
      name: 'seomi_pagespeed_insights', arguments: { url: 'https://8.8.8.8/' },
    });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.requested_url, 'https://8.8.8.8/');
  });
});

test('rank tracking falls back safely for a malformed target string', async () => {
  await withClient({ providers: { dataForSeo: async () => ({ result: [] }) } }, async (client) => {
    const result = await client.callTool({ name: 'seomi_track_rank', arguments: {
      keyword: 'seo', target: '%%% malformed target %%%',
    } });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.target_host, '%%% malformed target %%%');
    assert.deepEqual(result.structuredContent.matches, []);
  });
});

test('POST requests to unknown routes exercise the route guard', async () => {
  const token = 'mcp-route-contract-token';
  const api = await startLocalApi({ token, logger: () => {} });
  try {
    const response = await globalThis.fetch(`http://${api.host}:${api.port}/v1/unknown`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Route not found.' });
  } finally { await api.close(); }
});
