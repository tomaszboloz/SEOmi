import assert from 'node:assert/strict';
import test from 'node:test';
import { crawlPublicSite } from '../dist/auditWorkflow.js';

const audit = (url, links = []) => ({
  requested_url: url, final_url: url, status: 200, response_body_truncated: false, response_time_ms: 1,
  redirects: [], title: url, meta_description: null, canonical: null, robots: null, open_graph: {},
  headings: { h1: [] }, security_headers: {}, discovered_links: links, discovered_links_truncated: false,
  semantic_terms: [], semantic_links: [], semantic_content_source: 'unavailable',
});

test('discovered_urls counts every unique in-scope URL beyond the page limit', async () => {
  const validateStart = async (value) => ({ url: new URL(value), address: '93.184.216.34', family: 4 });
  const links = ['one', 'two', 'three', 'four', 'one'].map((name) => `https://example.com/${name}`)
    .concat('https://attacker.example/x');
  const runner = async (url) => audit(url, links);
  const result = await crawlPublicSite('https://example.com/', 15000, 2, 3, { scopeHost: 'example.com' }, runner, validateStart);
  assert.equal(result.pages.length, 2);
  assert.equal(result.discovered_urls, 5);
  assert.equal(result.truncated, true);
});

test('crawl runs at most 4 audits at once and keeps queue order regardless of timing', async () => {
  const validateStart = async (value) => ({ url: new URL(value), address: '93.184.216.34', family: 4 });
  let active = 0;
  let peak = 0;
  const names = Array.from({ length: 9 }, (_, index) => `https://example.com/p${index}`);
  const runner = async (url) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, url.endsWith('p0') ? 30 : 1));
    active -= 1;
    if (url.endsWith('p3')) throw new Error('boom');
    return audit(url, url.endsWith('/') ? names : []);
  };
  const result = await crawlPublicSite('https://example.com/', 15000, 20, 2, {}, runner, validateStart);
  assert.ok(peak > 1 && peak <= 4, `peak ${peak}`);
  assert.deepEqual(result.pages.map(({ audit: page }) => page.final_url),
    ['https://example.com/', ...names.filter((name) => !name.endsWith('p3'))]);
  assert.deepEqual(result.errors.map((error) => error.url), ['https://example.com/p3']);
  assert.equal(result.discovered_urls, 10);
  assert.equal(result.truncated, false);
});

test('a non-Error rejection is reported as text', async () => {
  const validateStart = async (value) => ({ url: new URL(value), address: '93.184.216.34', family: 4 });
  const result = await crawlPublicSite('https://example.com/', 15000, 1, 0, {}, async () => { throw 'plain'; }, validateStart);
  assert.equal(result.errors[0].error, 'plain');
});
