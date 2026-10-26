import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTopicalAuthority } from '@/hooks/useTopicalAuthority';
import type { ReferenceInput, ReferenceOutcome } from '@/services/topicalAuthorityReference';
import { chunkSections, scorePageAio } from '@/services/aioReadiness';
import { extractTriples } from '@/services/aioReadiness/spo';
import { rulesFor } from '@/services/aioReadiness/languageRules';
import { section, aioPage } from './aioFixtures';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const pages = ownSite();
const startUrl = `https://${OWN_HOST}/`;
const report = ownReport(pages);
const run = createCrawlRunFixture({ id: 'hook-run', startUrl, result: createCrawlResultFixture({ pages, start_url: startUrl }) });

describe('coverage 100 hook and AIO edges', () => {
  it('starts a fresh window when the overlapping paragraph is too large', () => {
    const chunks = chunkSections([section('Long', ['a '.repeat(200), 'b '.repeat(200)])]);
    expect(chunks.map((chunk) => chunk.paragraphs)).toEqual([['a '.repeat(200)], ['b '.repeat(200)]]);
    const overlap = chunkSections([section('Overlap', ['a '.repeat(260), 'b '.repeat(30), 'c '.repeat(30)])]);
    expect(overlap.map((chunk) => chunk.paragraphs)).toEqual([['a '.repeat(260), 'b '.repeat(30)], ['b '.repeat(30), 'c '.repeat(30)]]);
  });

  it('uses the empty language and URL fallbacks and rejects malformed SPO candidates', () => {
    const page = aioPage('https://a.test/fallback', [section('Facts', ['A fact is useful.'])], {
      final_url: '', semantic_language: null, document_language: undefined,
    });
    expect(scorePageAio(page as never).url).toBe(page.url);
    expect(extractTriples('A,B C is', rulesFor('en').rules)).toEqual([]);
    expect(extractTriples('A thing is .', rulesFor('en').rules)).toEqual([]);
    expect(extractTriples('A useful thing is .', rulesFor('en').rules)).toEqual([]);
  });

  it('returns each AIO skip reason with the request URL fallback', () => {
    expect(scorePageAio(aioPage('https://a.test/error', [], { http_status: 500, final_url: '' }) as never).skipped).toBe('request-error');
    expect(scorePageAio(aioPage('https://a.test/missing', undefined) as never).skipped).toBe('no-sections');
    expect(scorePageAio(aioPage('https://a.test/empty', [section('Empty', [])]) as never).skipped).toBe('no-content');
  });

  it('suppresses progress after cancellation and builds with an invalid host fallback', async () => {
    let progress!: (value: { phase: 'build'; done: number; total: number }) => void;
    let finish!: (value: ReferenceOutcome) => void;
    const runner = vi.fn((input: ReferenceInput): Promise<ReferenceOutcome> => {
      progress = input.onProgress!;
      return new Promise((resolve) => { finish = resolve; });
    });
    const view = renderHook(() => useTopicalAuthority({ pages, startUrl: 'not a URL', sfs: report, run, projectId: 'hook-p1', runner }));
    act(() => { void view.result.current.build(); });
    act(() => { view.result.current.cancel(); progress({ phase: 'build', done: 1, total: 1 }); });
    await act(async () => { finish({ status: 'ok', taxonomy: referenceTaxonomy(pages)!, competitors: [] }); await Promise.resolve(); });
    expect(view.result.current.taxonomy).toBeTruthy();
    expect(view.result.current.state.progress).toBeNull();
  });

  it('ignores a rejection from a superseded reference build', async () => {
    let rejectFirst!: (error: Error) => void;
    const runner = vi.fn()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
      .mockResolvedValueOnce({ status: 'cancelled' });
    const view = renderHook(() => useTopicalAuthority({ pages, startUrl, sfs: report, run, projectId: 'hook-p2', runner }));
    act(() => { void view.result.current.build(); });
    await act(async () => { await view.result.current.build(); });
    await act(async () => { rejectFirst(new Error('late')); await Promise.resolve(); });
    expect(view.result.current.state.failure?.status).toBe('cancelled');
  });

  it('keeps the trust hook report empty for an empty crawl', async () => {
    const { useTrust } = await import('@/hooks/useTrust');
    const view = renderHook(() => useTrust([], startUrl, null, null));
    expect(view.result.current.report).toBeNull();
    expect(view.result.current.previous).toBeUndefined();
    expect(NOW).toContain('2026');
  });

  it('records a trust snapshot for a populated crawl', async () => {
    const { useTrust } = await import('@/hooks/useTrust');
    const view = renderHook(() => useTrust(pages, startUrl, run, 'hook-trust'));
    await act(async () => { await Promise.resolve(); });
    expect(view.result.current.report).toBeTruthy();
  });
});
