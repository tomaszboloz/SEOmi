import assert from 'node:assert/strict';
import test from 'node:test';
import { startLocalApi } from '../dist/localApi.js';
import { withClient } from './testHelpers.mjs';

test('PageSpeed treats a missing audits payload as an empty evidence set', async () => {
  await withClient({
    publicTarget: async (url) => url,
    providers: {
      googleApiKey: () => 'fixture',
      googlePublicJson: async () => ({ lighthouseResult: { audits: null } }),
    },
  }, async (client) => {
    const result = await client.callTool({ name: 'seomi_pagespeed_insights', arguments: { url: 'https://example.com' } });
    assert.equal(result.isError, false);
    assert.deepEqual(result.structuredContent.audits, {});
  });
});

test('Local API rejects POST requests to unknown routes', async () => {
  const token = 'local-api-route-edge-token';
  const api = await startLocalApi({ token, audit: async () => ({}), logger: () => {} });
  try {
    const response = await globalThis.fetch(`http://${api.host}:${api.port}/unknown`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('allow'), 'GET, POST');
    assert.deepEqual(await response.json(), { error: 'Route not found.' });
  } finally {
    await api.close();
  }
});
