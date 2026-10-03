import { expect, it } from 'vitest';
import { compareSemanticRuns } from '@/services/semanticRunComparison';
import { comparisonPage, comparisonDocument } from './fixtures/semanticComparison';

it('reports changed matched query tokens even when their count stays the same', () => {
  const document = comparisonDocument([{ id: 'query', text: 'coffee espresso' }]);
  const page = (term: string) => comparisonPage('https://site.test/coffee', [term]);
  const report = compareSemanticRuns(document, { id: 'before', result: { pages: [page('coffee')] } as never }, { id: 'after', pages: [page('espresso')] });
  expect(report.counts['query-term-observation-changed']).toBe(1);
  const change = report.changes.find(item => item.code === 'query-term-observation-changed');
  expect(change).toMatchObject({ direction: 'changed', topicId: 'topic', urls: ['https://site.test/coffee'] });
  expect(change?.evidence.join(' ')).toContain('espresso');
  expect(change?.evidence.join(' ')).toContain('coffee');
});
