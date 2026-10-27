import { expect, it } from 'vitest';
import { comparisonText, pageIdentity, pageTerms, indexPages, assignedPages, queryObservation, countSemanticLinks, countTopicEdges } from '@/services/semanticRunComparison/evidence';
import { comparisonPage as page, comparisonDocument } from './fixtures/semanticComparison';
import i18n from '@/i18n';
it('localizes comparison evidence with supplied variables', () => {
  expect(comparisonText('http', { status: 404 })).toBe(i18n.t('runtimeErrors.semanticRunComparison.http', { status: 404 }));
});
it('normalizes page identity and falls back to a valid observed final URL', () => {
  expect(pageIdentity(page(' HTTPS://SITE.test:443/coffee/#top ', []))).toBe('https://site.test/coffee');
  expect(pageIdentity({ ...page('invalid', []), final_url: 'http://SITE.test:80/' })).toBe('http://site.test/');
  expect(pageIdentity({ ...page('invalid', []), final_url: 'file:///secret' })).toBeNull();
  expect(pageIdentity(page('https://site.test/coffee?q=1', []))).not.toBe(pageIdentity(page('https://site.test/coffee?q=2', [])));
});
it('bounds, normalizes and deduplicates only observed semantic terms', () => {
  expect([...pageTerms(page('https://site.test/', ['  COFFEE  ', 'ＣＯＦＦＥＥ', '', ' ']))]).toEqual([['und:coffee', 'COFFEE']]);
  expect(pageTerms(page('https://site.test/', Array.from({ length: 45 }, (_, index) => `term${index}`))).size).toBe(40);
  expect(pageTerms({ ...page('https://site.test/', []), semantic_terms: undefined }).size).toBe(0);
});
it('indexes both URL aliases, rejects invalid identities and does not exceed 5000 inputs', () => {
  const original = { ...page('https://site.test/coffee/', []), final_url: 'https://site.test/new/#top' };
  const index = indexPages([original, { ...page('invalid', []), final_url: 'invalid' }]);
  expect([...index.byIdentity.keys()]).toEqual(['https://site.test/coffee']);
  expect(index.byAlias.get('https://site.test/new')).toBe(original);
  const node = comparisonDocument().nodes[0]; node.sourceUrls = ['invalid', 'https://site.test/new', 'https://site.test/coffee', 'https://site.test/absent'];
  expect(assignedPages(node, index.byAlias)).toEqual([original]);
  const rows = Array.from({ length: 5001 }, (_, index) => page(`https://site.test/${index}`, []));
  expect(indexPages(rows).byIdentity.size).toBe(5000);
});
it('extracts bounded internal content links, preserving the first observed anchor', () => {
  const source = page('https://site.test/', []);
  source.semantic_links = [
    { target_url: 'https://site.test/a#one', anchor_text: ' First ', is_internal: true },
    { target_url: 'https://site.test/a#two', anchor_text: 'Second', is_internal: true },
    { target_url: 'invalid', anchor_text: 'Invalid', is_internal: true },
    { target_url: 'https://other.test/', anchor_text: 'External', is_internal: false },
  ] as never;
  expect([...countSemanticLinks([source]).values()]).toEqual([{ source: 'https://site.test/', target: 'https://site.test/a', anchor: 'First' }]);
  expect(countSemanticLinks([{ ...source, url: 'invalid' }, { ...source, semantic_links: undefined }]).size).toBe(0);
  source.semantic_links = Array.from({ length: 1001 }, (_, index) => ({ target_url: `https://site.test/${index}`, anchor_text: '', is_internal: true })) as never;
  expect(countSemanticLinks([source]).size).toBe(1000);
});
it('adapts real topic graph evidence and skips graph relations without valid URL identities', () => {
  expect(countTopicEdges([]).size).toBe(0);
  const terms = ['coffee', 'espresso', 'grinding'];
  const edges = countTopicEdges([page('https://site.test/a', terms), page('https://site.test/b', terms)]);
  expect([...edges.values()]).toEqual([{ source: 'https://site.test/a', target: 'https://site.test/b', sharedTerms: ['coffee', 'espresso', 'grinding'], weightedJaccard: 1 }]);
  expect(countTopicEdges([page('invalid', terms), page('https://site.test/b', terms)]).size).toBe(0);
});
it('uses observed normalized terms for query tokens and keeps unavailable evidence unavailable', () => {
  expect(queryObservation('ＣＯＦＦＥＥ espresso coffee!', [page('https://site.test/', ['coffee'])])).toEqual({ expected: ['coffee', 'espresso'], matched: ['coffee'] });
  expect(queryObservation('an', [page('https://site.test/', ['coffee'])])).toBeNull();
  expect(queryObservation('coffee', [page('https://site.test/', [])])).toBeNull();
  expect(queryObservation('coffee', [{ ...page('https://site.test/', []), semantic_terms: undefined }])).toBeNull();
});

it('does not use legacy noise or error-page terms as query evidence', () => {
  expect(queryObservation('coffee', [{ ...page('https://site.test/error', ['coffee']), http_status: 404 }])).toBeNull();
  expect(queryObservation('coffee', [{ ...page('https://site.test/noise', ['ale', '2026']) }])).toBeNull();
});

it('keeps nondefault ports distinct while URL parsing collapses default ports', () => {
  expect(pageIdentity(page('https://site.test:443/', []))).toBe('https://site.test/');
  expect(pageIdentity(page('http://site.test:80/', []))).toBe('http://site.test/');
  expect(pageIdentity(page('https://site.test:8443/', []))).toBe('https://site.test:8443/');
});
it('uses observed final URLs for graph fallback and rejects invalid aliased pages', () => {
  const terms = ['coffee', 'espresso'];
  const valid = { ...page('', terms), final_url: 'https://site.test/a' };
  const other = page('https://site.test/b', terms);
  expect([...countTopicEdges([valid, other]).values()][0]).toMatchObject({ source: 'https://site.test/a', target: 'https://site.test/b' });
  expect(countTopicEdges([page('', terms), other]).size).toBe(0);
  const node = comparisonDocument().nodes[0];
  expect(assignedPages(node, new Map([['https://site.test/coffee', page('invalid', [])]]))).toEqual([]);
});
