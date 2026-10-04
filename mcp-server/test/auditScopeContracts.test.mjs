import assert from 'node:assert/strict';
import test from 'node:test';
import { assertScope, globMatchesPath, isUrlWithinScope, normalizeCrawlUrl, normalizePatterns, normalizeScopePath, validatePublicScopeOptions } from '../dist/auditScope.js';

test('public URL/path/pattern normalization preserves queries and scope boundaries', () => {
  assert.equal(normalizeCrawlUrl('HTTPS://Example.COM:443/a?q=1#section'), 'https://example.com/a?q=1');
  assert.throws(() => normalizeCrawlUrl('not a URL'), TypeError);
  for (const [value, expected] of [[undefined, undefined], ['', undefined], ['  ', undefined], ['/', '/'], [' blog/ ', '/blog'], ['/blog///', '/blog']]) {
    assert.equal(normalizeScopePath(value), expected);
  }
  const input = [' /blog/* ', '', ' /blog/*', '/news'];
  assert.deepEqual(normalizePatterns(input), ['/blog/*', '/news']);
  assert.deepEqual(input, [' /blog/* ', '', ' /blog/*', '/news']);
  assert.deepEqual(normalizePatterns(undefined), []);
  assert.equal(normalizePatterns(Array.from({ length: 21 }, (_, i) => `/p${i}`)).length, 20);
});

test('public glob matching treats regex metacharacters literally and anchors paths', () => {
  for (const [path, pattern, expected] of [
    ['/blog/post', 'blog/*', true], ['/blog/post/part', '/blog/*', true],
    ['/blogging/post', '/blog/*', false], ['/prefix/blog/post', '/blog/*', false],
    ['/a.b+(x)?[z]$', '/a.b+(x)?[z]$', true], ['/axbxxz', '/a.b+(x)?[z]$', false],
    ['/a/b/c', '/a/*/c', true], ['/a/b/d', '/a/*/c', false],
  ]) assert.equal(globMatchesPath(path, pattern), expected, `${path} / ${pattern}`);
});

test('public scope checks separate descendants, lookalike hosts, exclusions and path siblings', () => {
  const options = { scopeHost: ' .EXAMPLE.com. ', allowSubdomains: true, scopePath: 'blog/', includePatterns: ['/blog/*'], excludePatterns: ['/blog/private*'] };
  for (const [url, expected] of [
    ['https://example.com/blog/post', true], ['https://news.example.com/blog/post', true],
    ['https://example.com/blog/private-note', false], ['https://example.com/blogging/post', false],
    ['https://example.com.attacker.test/blog/post', false], ['https://other.test/blog/post', false],
  ]) assert.equal(isUrlWithinScope(new URL(url), options), expected, url);
  assert.equal(isUrlWithinScope(new URL('https://sub.example.com/'), { scopeHost: 'example.com' }), false);
  assert.equal(isUrlWithinScope(new URL('https://example.com/blog'), { scopePath: '/blog/' }), true);
  assert.equal(isUrlWithinScope(new URL('https://example.com/'), { scopeHost: '...' }), false);
  assert.equal(isUrlWithinScope(new URL('https://example.com/'), {}), true);
  assert.doesNotThrow(() => assertScope(new URL('https://example.com/blog/post'), options));
  assert.throws(() => assertScope(new URL('https://other.test/blog/post'), options), /outside.*scope/);
  assert.throws(() => assertScope(new URL('https://example.com/private'), { scopePath: '/blog' }), /outside.*scope/);
});

test('scope validation accepts exact limits and rejects each unsafe field before transport', () => {
  assert.doesNotThrow(() => validatePublicScopeOptions({ scopePath: '/'.padEnd(2048, 'x'), includePatterns: Array(20).fill('x'.repeat(200)), excludePatterns: [] }));
  for (const scopePath of [true, '/'.repeat(2049), '/a\n', '/a\0']) {
    assert.throws(() => validatePublicScopeOptions({ scopePath }), /safe path/);
  }
  for (const field of ['includePatterns', 'excludePatterns']) {
    for (const value of [false, '/*', [42], Array(21).fill('/*'), ['x'.repeat(201)], ['/a\n']]) {
      assert.throws(() => validatePublicScopeOptions({ [field]: value }), /safe patterns/);
    }
  }
});
