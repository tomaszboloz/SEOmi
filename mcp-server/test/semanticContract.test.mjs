import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractSemanticSignals } from '../dist/auditSemantic.js';
import { SEMANTIC_STOPWORDS } from '../dist/semanticStopwords.js';
import { balancedBlocks } from '../dist/semanticRoot.js';
import { countSemanticTerms, isSemanticNoiseTerm, normalizeSemanticText } from '../dist/semanticTerms.js';

const base = new URL('https://example.com/');

test('stop-word copy matches the app JSON exactly', () => {
  const app = JSON.parse(readFileSync(new URL('../../src/constants/semanticStopwords.json', import.meta.url), 'utf8'));
  delete app._comment;
  assert.deepEqual(SEMANTIC_STOPWORDS, app);
});

test('noise rules match the app: stopwords with and without diacritics, digits, short tokens', () => {
  assert.equal(isSemanticNoiseTerm('być'), true);
  assert.equal(isSemanticNoiseTerm('BYC'), true);
  assert.equal(isSemanticNoiseTerm('2026'), true);
  assert.equal(isSemanticNoiseTerm('100k'), true);
  assert.equal(isSemanticNoiseTerm('b2b'), false);
  assert.equal(isSemanticNoiseTerm('2fa'), false);
  assert.equal(normalizeSemanticText('Łódź Straße'), 'lodz strasse');
});

test('same input gives the app-style topical terms', () => {
  const counts = countSemanticTerms('Pozycjonowanie pozycjonowanie jest ważne dla 2026 i b2b oraz Zażółć zazolc');
  assert.deepEqual([...counts.entries()], [['pozycjonowanie', 2], ['ważne', 1], ['b2b', 1], ['zażółć', 2]]);
});

test('nested article does not truncate primary content', () => {
  const html = '<body><article><p>alpha content</p><article><p>related beta</p></article><p>omega tail</p></article></body>';
  const result = extractSemanticSignals(html, base);
  assert.equal(result.source, 'primary-root');
  for (const term of ['alpha', 'related', 'beta', 'omega', 'tail']) assert.ok(result.terms.includes(term), term);
});

test('main wins over an earlier article, hidden roots are skipped, unclosed roots run to the end', () => {
  const both = extractSemanticSignals('<article><p>sidebarword</p></article><main><p>mainword</p></main>', base);
  assert.deepEqual(both.terms, ['mainword']);
  const hidden = extractSemanticSignals('<main hidden><p>secret</p></main><article><p>visible</p></article>', base);
  assert.deepEqual(hidden.terms, ['visible']);
  const open = extractSemanticSignals('<main><p>unclosed text', base);
  assert.deepEqual(open.terms, ['text', 'unclosed']);
  const none = extractSemanticSignals('<body><p>plain body</p></body>', base);
  assert.equal(none.source, 'body-fallback');
});

test('balancedBlocks ignores stray closers and self-closing tags', () => {
  assert.deepEqual(balancedBlocks('</main><main/><main a="1">x</main>', 'main'), [{ attrs: ' a="1"', inner: 'x' }]);
});
