import assert from 'node:assert/strict';
import test from 'node:test';
import { crawlPublicSite, extractPublicLinks, extractSemanticSignals, isUrlWithinScope } from '../dist/auditWorkflow.js';

const audit = (url, links = []) => ({
  requested_url: url,
  final_url: url,
  status: 200,
  response_body_truncated: false,
  response_time_ms: 1,
  redirects: [],
  title: url,
  meta_description: null,
  canonical: null,
  robots: null,
  open_graph: {},
  headings: { h1: [] },
  security_headers: {},
  discovered_links: links,
  discovered_links_truncated: false,
  semantic_terms: [],
  semantic_links: [],
  semantic_content_source: 'unavailable',
});

test('extracts only bounded HTTP links and normalizes fragments', () => {
  const result = extractPublicLinks('<a href="/a#one">A</a><a href="https://example.com/a#two">A2</a><a href="mailto:test@example.com">mail</a><a href="https://outside.example/x">out</a>', new URL('https://example.com/root'));
  assert.deepEqual(result, {
    links: ['https://example.com/a', 'https://outside.example/x'],
    truncated: false,
  });
});

test('extracts semantic signals from content only and removes chrome and hidden blocks', () => {
  const html = `
    <header><a href="https://example.com/header">header navigation</a></header>
    <main>
      <h1>Semantic gardening guide</h1>
      <p>Semantic gardening guide covers soil health and soil planning.</p>
      <nav><a href="https://example.com/nav">navigation topic</a></nav>
      <div class=sidebar><a href="https://example.com/sidebar">sidebar topic</a></div>
      <div hidden>hidden secret topic <a href="https://example.com/hidden">hidden link</a></div>
      <form><label>form topic</label></form>
      <div role="search"><a href="https://example.com/search">search topic</a></div>
      <a href="/content">content topic</a>
      <footer>footer topic</footer>
    </main>
  `;

  const result = extractSemanticSignals(html, new URL('https://example.com/'));

  assert.equal(result.source, 'primary-root');
  assert.ok(result.terms.includes('gardening'));
  assert.ok(result.terms.includes('soil'));
  assert.ok(!result.terms.includes('navigation'));
  assert.ok(!result.terms.includes('sidebar'));
  assert.ok(!result.terms.includes('hidden'));
  assert.ok(!result.terms.includes('search'));
  assert.ok(!result.terms.includes('footer'));
  assert.deepEqual(result.links, ['https://example.com/content']);
});

test('bounded crawl follows only scoped links and records page errors', async () => {
  const validateStart = async (value) => ({ url: new URL(value), address: '93.184.216.34', family: 4 });
  const runner = async (url) => {
    if (url.endsWith('/broken')) throw new Error('HTTP 503');
    if (url.endsWith('/')) return audit(url, ['https://example.com/a', 'https://example.com/broken', 'https://attacker.example/escape']);
    return audit(url, url.endsWith('/a') ? ['https://example.com/deeper'] : []);
  };

  const result = await crawlPublicSite('https://example.com/', 15000, 10, 1, { scopeHost: 'example.com' }, runner, validateStart);

  assert.deepEqual(result.pages.map(({ audit: page }) => page.final_url), [
    'https://example.com/',
    'https://example.com/a',
  ]);
  assert.deepEqual(result.errors, [{ url: 'https://example.com/broken', depth: 1, error: 'HTTP 503' }]);
});

test('crawl reports explicit truncation when the page limit prevents queued URLs', async () => {
  const validateStart = async (value) => ({ url: new URL(value), address: '93.184.216.34', family: 4 });
  const runner = async (url) => audit(url, ['https://example.com/one', 'https://example.com/two']);
  const result = await crawlPublicSite('https://example.com/', 15000, 1, 3, {}, runner, validateStart);

  assert.equal(result.pages.length, 1);
  assert.equal(result.truncated, true);
  assert.equal(result.discovered_urls, 3);
});

test('crawl returns a structured root error instead of inventing an empty page', async () => {
  const validateStart = async (value) => ({ url: new URL(value), address: '93.184.216.34', family: 4 });
  const result = await crawlPublicSite('https://example.com/', 15000, 5, 2, {}, async () => { throw new Error('network unavailable'); }, validateStart);

  assert.deepEqual(result.pages, []);
  assert.deepEqual(result.errors, [{ url: 'https://example.com/', depth: 0, error: 'network unavailable' }]);
  assert.equal(result.truncated, false);
});

test('scope path and include/exclude patterns are applied before queueing discovered URLs', async () => {
  assert.equal(isUrlWithinScope(new URL('https://example.com/docs/guide'), {
    scopeHost: 'example.com', scopePath: '/docs', includePatterns: ['/docs*'], excludePatterns: ['/docs/private/*'],
  }), true);
  assert.equal(isUrlWithinScope(new URL('https://example.com/docs/private/guide'), {
    scopeHost: 'example.com', scopePath: '/docs', includePatterns: ['/docs*'], excludePatterns: ['/docs/private/*'],
  }), false);

  const validateStart = async (value) => ({ url: new URL(value), address: '93.184.216.34', family: 4 });
  const runner = async (url) => audit(url, [
    'https://example.com/docs/guide',
    'https://example.com/docs/private/secret',
    'https://example.com/outside',
  ]);
  const result = await crawlPublicSite('https://example.com/docs', 15_000, 10, 2, {
    scopeHost: 'example.com', scopePath: '/docs', includePatterns: ['/docs*'], excludePatterns: ['/docs/private/*'],
  }, runner, validateStart);

  assert.deepEqual(result.pages.map(({ audit: page }) => page.final_url), [
    'https://example.com/docs',
    'https://example.com/docs/guide',
  ]);
  assert.deepEqual(result.scope_path, '/docs');
  assert.deepEqual(result.include_patterns, ['/docs*']);
  assert.deepEqual(result.exclude_patterns, ['/docs/private/*']);
});
