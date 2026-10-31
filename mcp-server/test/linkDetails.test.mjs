import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLinkDetails, MAX_LINK_DETAILS } from '../dist/linkDetails.js';
import { elementZone, readAttribute, redactWord } from '../dist/linkZone.js';

const base = new URL('https://example.test/page');
const words = (count, prefix) => Array.from({ length: count }, (_, i) => `${prefix}${i}`).join(' ');

test('link details record zone, rel and anchor per DOM ancestry like the app crawler', () => {
  const html = `<header><a href="/home">Home</a></header>
    <nav class="breadcrumbs"><a href="/a">A</a></nav>
    <main><p>Read the <a href="/guide#top" rel="NoFollow Sponsored">full <b>guide</b></a> now.</p>
      <div class="related-widget"><a href="https://other.test/x">Other</a></div>
      <aside><div class="widget"><a href="/side">Side</a></div></aside></main>
    <footer role="contentinfo"><a href="/legal">Legal</a></footer><a href="/loose">Loose</a>`;
  const { links, truncated } = extractLinkDetails(html, base);
  assert.equal(truncated, false);
  assert.deepEqual(links.map((l) => [l.url, l.zone]), [
    ['https://example.test/home', 'nav_breadcrumb'],
    ['https://example.test/a', 'nav_breadcrumb'],
    ['https://example.test/guide', 'main'],
    ['https://other.test/x', 'widget'],
    ['https://example.test/side', 'sidebar_footer'],
    ['https://example.test/legal', 'sidebar_footer'],
    ['https://example.test/loose', 'unknown'],
  ]);
  const guide = links[2];
  assert.equal(guide.anchor_text, 'full guide');
  assert.equal(guide.rel, 'nofollow sponsored');
  assert.equal(guide.nofollow, true);
  assert.equal(guide.zone_method, 'html-ancestry');
  assert.equal(guide.context_before, 'Read the');
  assert.equal(guide.context_after, 'now.');
  assert.equal(links[3].is_internal, false);
  assert.equal(links[6].context_before, null, 'no block ancestor means no context');
});

test('context keeps 15 words per side inside the block, skips hidden code and redacts secrets', () => {
  const html = `<p>outside</p><section>${words(20, 'b')} <script>var x = "secret";</script><!-- note -->
    mail jan@example.test <a href="/t">target</a> 123456789012 ${words(20, 'a')}</section><p>later</p>`;
  const [link] = extractLinkDetails(html, base).links;
  const before = link.context_before.split(' ');
  assert.equal(before.length, 15);
  assert.deepEqual(before.slice(-2), ['mail', '[email]']);
  assert.ok(!link.context_before.includes('secret'));
  const after = link.context_after.split(' ');
  assert.equal(after.length, 15);
  assert.equal(after[0], '[number]');
  assert.ok(!link.context_after.includes('later'));
});

test('malformed, unsafe and excess links are skipped or flagged as truncated', () => {
  const unsafe = '<p><a href="javascript:alert(1)">x</a><a href="http://[bad">y</a><a>no href</a><a href="/ok">ok<a href="/next">next</p>';
  const { links } = extractLinkDetails(unsafe, base);
  assert.deepEqual(links.map((l) => [l.url, l.anchor_text]), [['https://example.test/ok', 'ok'], ['https://example.test/next', 'next']]);
  const many = Array.from({ length: MAX_LINK_DETAILS + 2 }, (_, i) => `<a href="/p${i}">p</a><br/><img src="x">`).join('');
  const bounded = extractLinkDetails(`<div>${many}</div>`, base);
  assert.equal(bounded.links.length, MAX_LINK_DETAILS);
  assert.equal(bounded.truncated, true);
  assert.equal(extractLinkDetails('<p>a < b</p><a href="/z">z', base).links[0].anchor_text, 'z');
  const [unclosed] = extractLinkDetails('<div>lead <span/><a href="/u">u</a> tail', base).links;
  assert.deepEqual([unclosed.context_before, unclosed.context_after], ['lead', 'tail']);
});

test('zone helpers read quoted and bare attributes and redact token-like words', () => {
  assert.equal(readAttribute(' data-id="x" id=main-nav', 'id'), 'main-nav');
  assert.equal(readAttribute(" class='a b'", 'class'), 'a b');
  assert.equal(readAttribute('', 'role'), '');
  assert.deepEqual(elementZone('div', 'role="main"'), ['main', 1]);
  assert.deepEqual(elementZone('div', 'id="Sidebar"'), ['sidebar_footer', 3]);
  assert.equal(elementZone('span', 'class="lead"'), null);
  assert.equal(redactWord('abc123def456ghi789jkl012mno'), '[token]');
  assert.equal(redactWord('(plain)'), '(plain)');
});
