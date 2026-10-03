import assert from 'node:assert/strict';
import test from 'node:test';
import { auditPublicUrl, isUrlWithinScope, validatePublicScopeOptions } from '../dist/auditWorkflow.js';

test('scope policy permits the exact host and optional subdomains only', () => {
  const exact = new URL('https://example.com/audit');
  const subdomain = new URL('https://www.example.com/audit');
  const lookalike = new URL('https://example.com.attacker.invalid/audit');
  assert.equal(isUrlWithinScope(exact, { scopeHost: 'example.com' }), true);
  assert.equal(isUrlWithinScope(subdomain, { scopeHost: 'example.com' }), false);
  assert.equal(isUrlWithinScope(subdomain, { scopeHost: 'example.com', allowSubdomains: true }), true);
  assert.equal(isUrlWithinScope(lookalike, { scopeHost: 'example.com', allowSubdomains: true }), false);
});


for (const target of ['http://127.0.0.1/private', 'http://[::1]/private', 'https://user:secret@example.com/', 'javascript:alert(1)']) {
  test(`direct public audit rejects unsafe input before a transport request: ${target}`, async () => {
    await assert.rejects(auditPublicUrl(target, 100), /public|credentials|HTTP|HTTPS|loopback|private/i);
  });
}


test('scope option contract accepts safe limits and rejects invalid shapes before auditing', () => {
  assert.equal(validatePublicScopeOptions({scopePath:'/guides',includePatterns:['/guides/*'],excludePatterns:['/guides/private/*']}), undefined);
  assert.throws(() => validatePublicScopeOptions({scopePath:'bad\npath'}), /scope_path/);
  assert.throws(() => validatePublicScopeOptions({includePatterns:Array(21).fill('/*')}), /at most 20/);
  assert.throws(() => validatePublicScopeOptions({excludePatterns:[42]}), /safe patterns/);
});
