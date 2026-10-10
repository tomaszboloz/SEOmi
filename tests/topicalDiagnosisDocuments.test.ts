import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildDiagnosisDocuments, documentSection, paginationParent, titleTokens } from '@/services/topicalDiagnosis/documents';

const page = (url: string, patch: Record<string, unknown> = {}) => createCrawlPageFixture({
  url, final_url: url, semantic_language: 'pl', semantic_terms: ['szkolenie', 'linkedin'], ...patch,
});

describe('buildDiagnosisDocuments', () => {
  it('merges reciprocal hreflang pairs into one document and keeps the start language primary', () => {
    const pl = page('https://ex.test/blog/a/', { hreflangs: [{ language: 'en', target_url: 'https://ex.test/en/blog/a', reciprocal_in_run: true }] });
    const en = page('https://ex.test/en/blog/a/', {
      semantic_language: 'en', semantic_terms: ['training'],
      hreflangs: [{ language: 'pl', target_url: 'https://ex.test/blog/a/#top', reciprocal_in_run: true }],
    });
    const { documents, mergedPairs } = buildDiagnosisDocuments([en, pl], 'https://ex.test/');
    expect(documents).toHaveLength(1);
    expect(mergedPairs).toBe(1);
    expect(documents[0].primaryPage.url).toBe('https://ex.test/blog/a/');
    expect(documents[0].languages).toEqual(['en', 'pl']);
    expect([...documents[0].terms]).toEqual(expect.arrayContaining(['pl:szkolen', 'en:training']));
    expect(documents[0].urls.has('https://ex.test/en/blog/a')).toBe(true);
  });

  it('does not merge one-sided or x-default hreflang', () => {
    const a = page('https://ex.test/a/', {
      hreflangs: [
        { language: 'en', target_url: 'https://ex.test/en/a/', reciprocal_in_run: false },
        { language: 'x-default', target_url: 'https://ex.test/en/a/', reciprocal_in_run: true },
      ],
    });
    const b = page('https://ex.test/en/a/', { semantic_language: 'en' });
    const { documents, mergedPairs } = buildDiagnosisDocuments([a, b], 'https://ex.test/');
    expect(documents).toHaveLength(2);
    expect(mergedPairs).toBe(0);
  });

  it('folds pagination pages into the first page of the chain and survives cycles', () => {
    const root = page('https://ex.test/blog/', { pagination_next: 'https://ex.test/blog/page/2/' });
    const second = page('https://ex.test/blog/page/2/', { pagination_prev: 'https://ex.test/blog/', pagination_next: 'https://ex.test/blog/page/3/' });
    const third = page('https://ex.test/blog/page/3/', { pagination_prev: 'https://ex.test/blog/page/2/' });
    const loopA = page('https://ex.test/x/', { pagination_prev: 'https://ex.test/y/' });
    const loopB = page('https://ex.test/y/', { pagination_prev: 'https://ex.test/x/' });
    const { documents } = buildDiagnosisDocuments([third, second, root, loopA, loopB], 'https://ex.test/');
    const blog = documents.find((document) => document.primaryPage.url === 'https://ex.test/blog/')!;
    expect(blog.pages.map((candidate) => candidate.url)).toEqual([
      'https://ex.test/blog/', 'https://ex.test/blog/page/3/', 'https://ex.test/blog/page/2/',
    ]);
    expect(documents).toHaveLength(2);
  });

  it('skips non-HTML and non-2xx pages and tolerates missing hreflangs', () => {
    const image = page('https://ex.test/a.jpg', { content_type: 'image/jpeg' });
    const gone = page('https://ex.test/gone/', { http_status: 404 });
    const ok = page('https://ex.test/ok/');
    delete (ok as Partial<typeof ok>).hreflangs;
    const { documents, skippedPages } = buildDiagnosisDocuments([image, gone, ok], 'https://ex.test/');
    expect(documents.map((document) => document.primaryPage.url)).toEqual(['https://ex.test/ok/']);
    expect(skippedPages).toBe(2);
  });

  it('records partial evidence only for a truncated body, not for the term cap', () => {
    const { documents } = buildDiagnosisDocuments([
      page('https://ex.test/en/oferta/x/', { semantic_language: 'en', body_truncated: true }),
      page('https://ex.test/long/', { semantic_content_partial: true }),
    ], 'https://ex.test/');
    expect(documents[0].section).toBe('oferta');
    expect(documents[0].partialEvidence).toBe(true);
    expect(documents[1].partialEvidence).toBe(false);
  });

  it('folds only real pagination paths, never product-style /p/123 URLs', () => {
    expect(paginationParent('https://ex.test/blog/page/3/')).toBe('https://ex.test/blog/');
    expect(paginationParent('https://ex.test/blog/strona/2')).toBe('https://ex.test/blog/');
    expect(paginationParent('https://shop.test/p/123')).toBeNull();
    expect(paginationParent('not a url')).toBeNull();
    const { documents } = buildDiagnosisDocuments([page('https://shop.test/'), page('https://shop.test/p/123'), page('https://shop.test/p/456/')], 'https://shop.test/');
    expect(documents).toHaveLength(3);
  });

  it('derives section and title tokens', () => {
    expect(documentSection('https://ex.test/en/blog/post/')).toBe('blog');
    expect(documentSection('https://ex.test/')).toBe('(root)');
    expect(documentSection('https://ex.test/oferta/')).toBe('oferta');
    expect(documentSection('not a url')).toBe('(root)');
    const tokens = titleTokens('Alerty Sales Navigatora w powiadomieniach | Rafał Szymański', 'pl');
    expect(tokens.map((token) => token.display)).toEqual(['alerty', 'sales', 'navigatora', 'powiadomieniach']);
    expect(tokens[0].key).toBe('pl:alert');
    const english = titleTokens('LinkedIn Trainer in Poland — Rafał Szymański', 'en').map((token) => token.display);
    expect(english).toContain('trainer');
    expect(english).not.toContain('rafał');
    expect(titleTokens(null, 'pl')).toEqual([]);
  });
});
