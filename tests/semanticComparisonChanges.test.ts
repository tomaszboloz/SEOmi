import { expect, it } from 'vitest';
import { comparePageChanges } from '@/services/semanticRunComparison/pageChanges';
import { compareRelationChanges } from '@/services/semanticRunComparison/relationChanges';
import { compareTopicChanges } from '@/services/semanticRunComparison/topicChanges';
import { indexPages } from '@/services/semanticRunComparison/evidence';
import type { SemanticRunChange } from '@/services/semanticRunComparison/types';
import { comparisonPage as page, comparisonDocument } from './fixtures/semanticComparison';
it('directly compares added, missing, unchanged and changed pages', () => {
  const changes: SemanticRunChange[] = [];
  const before = [page('https://site.test/coffee', ['coffee']), page('https://site.test/removed', [])];
  const after = [page('https://site.test/coffee', ['espresso']), page('https://site.test/added', [])];
  comparePageChanges(indexPages(before), indexPages(after), change => changes.push(change));
  expect(changes.map(change => change.code)).toEqual(['url-added', 'url-not-observed', 'content-terms-changed']);
  expect(changes[2].evidence.join(' ')).toContain('espresso');
  const unchanged: SemanticRunChange[] = [];
  comparePageChanges(indexPages(before), indexPages(before), change => unchanged.push(change));
  expect(unchanged).toEqual([]);
});
it('compares both added and missing content links with observed or unavailable anchors', () => {
  const before = page('https://site.test/', []); const after = page('https://site.test/', []);
  before.semantic_links = [{ target_url: 'https://site.test/old', anchor_text: '', is_internal: true }] as never;
  after.semantic_links = [{ target_url: 'https://site.test/new', anchor_text: '', is_internal: true }] as never;
  const changes: SemanticRunChange[] = [];
  compareRelationChanges([before], [after], change => changes.push(change));
  expect(changes.map(change => change.code)).toEqual(['content-link-added', 'content-link-not-observed']);
  expect(changes.map(change => change.urls[1])).toEqual(['https://site.test/new', 'https://site.test/old']);
  const unchanged: SemanticRunChange[] = [];
  compareRelationChanges([before], [before], change => unchanged.push(change));
  expect(unchanged).toEqual([]);
});
it('compares real lexical relations directly without labeling them as crawled links', () => {
  const common = ['coffee', 'espresso', 'grinding'];
  const together = [page('https://site.test/a', common), page('https://site.test/b', common)];
  const separate = [page('https://site.test/a', common), page('https://site.test/b', ['tea'])];
  const changes: SemanticRunChange[] = [];
  compareRelationChanges(separate, together, change => changes.push(change));
  compareRelationChanges(together, separate, change => changes.push(change));
  expect(changes.map(change => change.code)).toEqual(['topic-edge-added', 'topic-edge-not-observed']);
  expect(changes[0].evidence.join(' ')).toContain('Jaccard');
});
it.each([
  [['coffee'], ['coffee', 'espresso'], 'increased'],
  [['coffee', 'espresso'], ['coffee'], 'decreased'],
  [['coffee'], ['espresso'], 'changed'],
] as const)('reports query observation direction from actual token changes: %j %j %s', (before, after, direction) => {
  const document = comparisonDocument([{ id: 'query', text: 'coffee espresso' }]);
  const changes: SemanticRunChange[] = [];
  compareTopicChanges(document, indexPages([page('https://site.test/coffee', [...before])]), indexPages([page('https://site.test/coffee', [...after])]), change => changes.push(change));
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({ code: 'query-term-observation-changed', direction, topicId: 'topic' });
});
it('does not infer query changes from absent or identical observations', () => {
  const document = comparisonDocument([{ id: 'query', text: 'coffee' }, { id: 'short', text: 'an' }]);
  const changes: SemanticRunChange[] = [];
  const observed = indexPages([page('https://site.test/coffee', ['coffee'])]);
  compareTopicChanges(document, observed, observed, change => changes.push(change));
  expect(changes).toEqual([]);
  compareTopicChanges(document, observed, indexPages([]), change => changes.push(change));
  expect(changes.map(change => change.code)).toEqual(['topic-url-coverage-changed']);
  expect(changes[0].urls).toEqual(['https://site.test/coffee']);
});
it('reports newly observed topic URLs and keeps queries bounded to the first hundred', () => {
  const document = comparisonDocument(Array.from({ length: 101 }, (_, index) => ({ id: `query-${index}`, text: 'coffee espresso' })));
  const before = indexPages([page('https://site.test/coffee', ['coffee'])]);
  const after = indexPages([page('https://site.test/coffee', ['espresso'])]);
  const changes: SemanticRunChange[] = [];
  compareTopicChanges(document, before, after, change => changes.push(change));
  expect(changes).toHaveLength(100);
  expect(changes.some(change => change.id.endsWith(':query-100'))).toBe(false);
  const coverage: SemanticRunChange[] = [];
  compareTopicChanges(document, indexPages([]), after, change => coverage.push(change));
  expect(coverage[0]).toMatchObject({ code: 'topic-url-coverage-changed', urls: ['https://site.test/coffee'] });
});

it('distinguishes one-sided term additions and removals and defaults unavailable term counts', () => {
  const changes: SemanticRunChange[] = [];
  const full = indexPages([page('https://site.test/coffee', ['coffee'])]);
  const empty = indexPages([{ ...page('https://site.test/coffee', []), semantic_terms: undefined }]);
  comparePageChanges(empty, full, change => changes.push(change));
  comparePageChanges(full, empty, change => changes.push(change));
  expect(changes.map(change => change.code)).toEqual(['content-terms-changed', 'content-terms-changed']);
  expect(changes[0].evidence.join(' ')).toContain('coffee');
  const urlChanges: SemanticRunChange[] = [];
  comparePageChanges(indexPages([]), empty, change => urlChanges.push(change));
  comparePageChanges(empty, indexPages([]), change => urlChanges.push(change));
  expect(urlChanges).toHaveLength(2);
  expect(urlChanges.every(change => change.evidence.some(value => value.includes('0')))).toBe(true);
});
it('preserves nonempty content-link anchors and skips unchanged topic relations', () => {
  const old = page('https://site.test/', ['coffee', 'espresso']);
  const current = page('https://site.test/', ['coffee', 'espresso']);
  old.semantic_links = [{ target_url: 'https://site.test/old', anchor_text: 'Old anchor', is_internal: true }] as never;
  current.semantic_links = [{ target_url: 'https://site.test/new', anchor_text: 'New anchor', is_internal: true }] as never;
  const changes: SemanticRunChange[] = [];
  compareRelationChanges([old], [current], change => changes.push(change));
  expect(changes[0].evidence.join(' ')).toContain('New anchor');
  expect(changes[1].evidence.join(' ')).toContain('Old anchor');
  const unchanged: SemanticRunChange[] = [];
  const pages = [old, page('https://site.test/other', ['coffee', 'espresso'])];
  compareRelationChanges(pages, pages, change => unchanged.push(change));
  expect(unchanged).toEqual([]);
});
