import assert from 'node:assert/strict';
import test from 'node:test';
import { URL } from 'node:url';
import {
  crawlPublicSite,
  extractPublicLinks,
  extractSemanticSignals,
  isUrlWithinScope,
} from '../dist/auditWorkflow.js';
import { validatePublicTarget } from '../dist/httpSafety.js';
import { normalizeResearchDomain, prepareBacklinkGapDomains } from '../dist/contracts/researchDomain.js';

const baseUrl = new URL('https://example.com/');
const validateStart = async (value) => ({ url: new URL(value), address: '93.184.216.34', family: 4 });
const audit = (url, discovered_links = [], discovered_links_truncated = false) => ({
  final_url: url, discovered_links, discovered_links_truncated,
});

test('semantic extraction handles empty, malformed, bounded, and tokenless content', () => {
  const empty = extractPublicLinks('<a href=""><a href="http://[broken">', baseUrl);
  assert.deepEqual(empty, { links: [], truncated: false });

  const html = Array.from({ length: 2001 }, (_, index) => `<a href="/${index}">x</a>`).join('');
  const bounded = extractPublicLinks(html, baseUrl);
  assert.equal(bounded.links.length, 2000);
  assert.equal(bounded.truncated, true);

  const signals = extractSemanticSignals('<main><section data-visible="yes">a an</section></main>', baseUrl);
  assert.equal(signals.source, 'primary-root');
  assert.deepEqual(signals.terms, []);
});

test('crawl records provider string failures and explicit truncation', async () => {
  let first = true;
  const truncated = await crawlPublicSite('https://example.com/', 1000, 1, 2, {}, async (url) => {
    assert.equal(first, true);
    first = false;
    return audit(url, ['http://[broken', 'https://example.com/next'], true);
  }, validateStart);
  assert.equal(truncated.discovered_urls, 2);
  assert.equal(truncated.truncated, true);

  const invalidLimit = await crawlPublicSite('https://example.com/', 1000, Number.NaN, 2, {}, async () => {
    throw new Error('runner must not start with a NaN page limit');
  }, validateStart);
  assert.deepEqual(invalidLimit.pages, []);
  assert.equal(invalidLimit.truncated, true);

  const failed = await crawlPublicSite('https://example.com/', 1000, 2, 2, {}, async (url) => {
    if (url.endsWith('/')) return audit(url, ['https://example.com/next']);
    throw 'string crawler failure';
  }, validateStart);
  assert.deepEqual(failed.errors, [{ url: 'https://example.com/next', depth: 1, error: 'string crawler failure' }]);
});

test('scope and public-target contracts reject their bounded edge inputs', async () => {
  assert.equal(isUrlWithinScope(new URL('https://example.com/private'), {
    scopeHost: 'example.com', includePatterns: ['/docs/*'],
  }), false);
  await assert.rejects(validatePublicTarget('https://fixture.example/', async () => []), /private|special-purpose/i);
  assert.throws(() => normalizeResearchDomain(''), /Enter a domain/);
  const competitors = Array.from({ length: 20 }, (_, index) => `competitor-${index}.example.com`);
  assert.throws(() => prepareBacklinkGapDomains('example.com', competitors), /at most 19/);
});
