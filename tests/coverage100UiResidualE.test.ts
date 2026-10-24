import { describe, expect, it } from 'vitest';
import { buildParityReport } from '@/components/Charts/semanticTopical/signals/parityAdapter';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, language: string, words: number) => ({ url, document_language: language, word_count: words } as unknown as CrawledPageSummary);

describe('semantic signal adapter guards', () => {
  it('skips pages without language or graph topic and compares mapped languages', () => {
    const pages = [page('https://site.test/en', 'EN-us', 100), page('https://site.test/fr', 'fr', 40), page('https://site.test/no-language', '', 10), page('https://site.test/no-topic', 'en', 10)];
    const graph = { truncated: false, nodes: [{ page: { url: 'https://site.test/en' }, clusterId: 'topic' }, { page: { url: 'https://site.test/fr' }, clusterId: 'topic' }] };
    const report = buildParityReport(pages, graph as never);
    expect(report.status).toBe('ready');
    expect(report.rows).toEqual([expect.objectContaining({ language: 'fr', topic: 'topic', status: 'shallow', depth: 40, referenceDepth: 100 })]);
  });
});
