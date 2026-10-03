import { expect, it } from 'vitest';
import { compareSemanticRuns } from '@/services/semanticRunComparison';
import { comparisonPage as page, comparisonDocument } from './fixtures/semanticComparison';
it('reports the full change count while retaining at most five hundred details', () => {
  const pages = Array.from({ length: 501 }, (_, index) => page(`https://site.test/${index}`, []));
  const report = compareSemanticRuns(comparisonDocument(), { id: 'before', result: { pages: [] } as never }, { id: 'after', pages });
  expect(report).toMatchObject({ baselineRunId: 'before', currentRunId: 'after', truncated: true });
  expect(report.changes).toHaveLength(500); expect(report.counts['url-added']).toBe(501);
});
it.each(['before', 'after'])('marks truncated source evidence when the %s snapshot exceeds five thousand pages', side => {
  const pages = Array.from({ length: 5001 }, (_, index) => page(`https://site.test/${index}`, []));
  const before = side === 'before' ? pages : []; const after = side === 'after' ? pages : [];
  const report = compareSemanticRuns(comparisonDocument(), { id: 'before', result: { pages: before } as never }, { id: 'after', pages: after });
  expect(report.truncated).toBe(true);
  expect(report.counts[side === 'before' ? 'url-not-observed' : 'url-added']).toBe(5000);
  expect(report.changes).toHaveLength(500);
});
it('marks topic graph evidence as bounded even when more than five hundred unchanged pages generate no deltas', () => {
  const pages = Array.from({ length: 501 }, (_, index) => page(`https://site.test/${index}`, []));
  const report = compareSemanticRuns(comparisonDocument(), { id: 'before', result: { pages } as never }, { id: 'after', pages });
  expect(report.truncated).toBe(true); expect(report.changes).toEqual([]);
});
