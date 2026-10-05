import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePublicTarget } from '../dist/httpSafety.js';

const neverResolve = async () => { throw new Error('DNS must not be reached for a blocked local name'); };

test('root-dot local names are blocked before DNS resolution', async () => {
  for (const url of ['http://localhost./', 'https://printer.local./', 'https://api.internal./', 'https://router.lan../']) {
    await assert.rejects(validatePublicTarget(url, neverResolve), /Local and private network targets are blocked/, url);
  }
});

test('a public root-dot host still resolves normally', async () => {
  const target = await validatePublicTarget('https://example.com./', async () => [{ address: '93.184.216.34', family: 4 }]);
  assert.equal(target.address, '93.184.216.34');
});
