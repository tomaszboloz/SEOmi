import assert from 'node:assert/strict';
import test from 'node:test';
import { startLocalApi } from '../dist/localApi.js';
import { extractSemanticSignals } from '../dist/auditSemantic.js';
import { globMatchesPath } from '../dist/auditScope.js';
import { validatePublicTarget } from '../dist/httpSafety.js';

test('semantic cleanup replaces an unclosed chrome tag and keeps its text', () => {
  const result = extractSemanticSignals(
    '<main><div class="header">visible content</main>',
    new URL('https://example.com/'),
  );
  assert.equal(result.source, 'primary-root');
  assert.deepEqual(result.terms, ['content', 'visible']);
});

test('scope glob matching fails closed for a malformed matcher result', () => {
  const pattern = { startsWith: () => true, split: () => ({ map: () => ['['] }) };
  assert.equal(globMatchesPath('/anything', pattern), false);
});

test('target validation rejects a resolver result whose address loses its IP family', async () => {
  let calls = 0;
  const address = {
    toString: () => (++calls < 3 ? '8.8.8.8' : 'not-an-ip'),
    split: () => ['8', '8', '8', '8'],
  };
  await assert.rejects(
    validatePublicTarget('https://resolver.example/', async () => [{ address, family: 4 }]),
    /valid IP/,
  );
});

test('local API treats an absent request URL as an unknown route', async () => {
  const token = 'mcp-missing-url-contract-token';
  const api = await startLocalApi({ token, logger: () => {} });
  let finish;
  const response = {
    statusCode: 200,
    headersSent: false,
    setHeader() {},
    once(event, callback) { if (event === 'finish') finish = callback; },
    end(body) { this.body = body; this.headersSent = true; finish?.(); },
  };
  try {
    const listener = api.server.listeners('request')[0];
    listener({ method: 'POST', url: undefined, headers: { authorization: `Bearer ${token}` } }, response);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), { error: 'Route not found.' });
  } finally {
    await api.close();
  }
});
