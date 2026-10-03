import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matchAiCitationToCrawl } from '@/services/aiCitationEvidence';
import type { CrawlRunRecord } from '@/types';

const run = (pages: Array<Record<string, unknown>>) => ({ result: { pages } }) as unknown as CrawlRunRecord;

describe('AI citation evidence accuracy', () => {
  it('prefers an exact request URL over an earlier page redirect alias', () => {
    const snapshot = run([
      { url: 'https://site.test/legacy', final_url: 'https://site.test/article', title: 'Legacy' },
      { url: 'https://site.test/article', title: 'Actual request' },
    ]);
    expect(matchAiCitationToCrawl('https://site.test/article', snapshot))
      .toMatchObject({ matchKind: 'request_url', page: { url: 'https://site.test/article', title: 'Actual request' } });
  });

  it('does not attribute a shared redirect alias to an arbitrary page', () => {
    const snapshot = run([
      { url: 'https://site.test/a', final_url: 'https://site.test/shared' },
      { url: 'https://site.test/b', final_url: 'https://site.test/shared' },
    ]);
    expect(matchAiCitationToCrawl('https://site.test/shared', snapshot).matched).toBe(false);
  });

  it('reports complete coverage independently of the twelve displayed terms', () => {
    const terms = Array.from({ length: 40 }, (_, index) => `term${index}`);
    const evidence = matchAiCitationToCrawl('https://site.test/a', run([{ url: 'https://site.test/a', semantic_terms: terms }]), terms.join(' '));
    expect(evidence.context).toMatchObject({ coveragePercent: 100, sourceTermCount: 40 });
    expect(evidence.context?.matchedTerms).toHaveLength(12);
  });

  it('keeps term offsets in the original text when lowercase expands an earlier character', () => {
    const text = 'İ coffee';
    const context = matchAiCitationToCrawl('https://site.test/a', run([{ url: 'https://site.test/a', title: 'coffee' }]), text).context;
    expect(context?.matchedTermEvidence).toEqual([{ term: 'coffee', response: { start: 2, end: 8 }, source: { start: 0, end: 6 } }]);
    const span = context!.matchedTermEvidence[0].response!;
    expect(text.slice(span.start, span.end)).toBe('coffee');
  });

  it('points at a complete matching term rather than a substring inside a different word', () => {
    const text = 'article art';
    const context = matchAiCitationToCrawl('https://site.test/a', run([{ url: 'https://site.test/a', title: 'art' }]), text).context;
    expect(context?.matchedTermEvidence[0].response).toEqual({ start: 8, end: 11 });
  });

  it('keeps citation evidence source modules within 150 physical lines', () => {
    const directory = 'src/services/citationEvidence';
    for (const file of ['src/services/aiCitationEvidence.ts', ...readdirSync(directory).map((name) => `${directory}/${name}`)]) {
      const source = readFileSync(file, 'utf8');
      expect(source.split('\n').length - Number(source.endsWith('\n')), file).toBeLessThanOrEqual(150);
    }
  });
});
