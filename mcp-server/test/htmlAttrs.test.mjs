import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalHref, extractAttr, firstMeta, parseTagAttrs } from '../dist/htmlAttrs.js';

test('meta content keeps apostrophe inside double quotes and quotes inside single quotes', () => {
  const html = `<meta name="description" content="User's guide">
    <meta property='og:title' content='Say "hi" &amp; go'>
    <meta content="Reversed order" name="robots"><meta name=author content=bare>`;
  assert.equal(firstMeta(html, 'description'), "User's guide");
  assert.equal(firstMeta(html, 'og:title'), 'Say "hi" & go');
  assert.equal(firstMeta(html, 'robots'), 'Reversed order');
  assert.equal(firstMeta(html, 'author'), 'bare');
  assert.equal(firstMeta(html, 'missing'), null);
  assert.equal(firstMeta('<meta name="description" content="">', 'description'), null);
});

test('canonical is found for any attribute order and rel token list', () => {
  assert.equal(canonicalHref('<link href="https://a.test/x" rel="canonical">'), 'https://a.test/x');
  assert.equal(canonicalHref('<link rel="canonical alternate" href="https://a.test/y"/>'), 'https://a.test/y');
  assert.equal(canonicalHref('<link rel=CANONICAL href=https://a.test/z>'), 'https://a.test/z');
  assert.equal(canonicalHref('<link rel="alternate" href="/a"><link rel="canonical">'), null);
});

test('attribute helpers handle duplicates, valueless and missing attributes', () => {
  assert.equal(extractAttr(' a="1" a="2" disabled', 'a'), '1');
  assert.equal(parseTagAttrs('disabled').get('disabled'), '');
  assert.equal(extractAttr('x=1', 'y'), null);
});
