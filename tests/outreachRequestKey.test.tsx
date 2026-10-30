import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrawledPageSummarySchema } from '@/services/contracts/crawl/crawlSummary';
import { informationGainRequestKey, informationGainTarget } from '@/services/outreachCopilot/requestKey';
import type { BacklinkGapReport, CrawledPageSummary } from '@/types';

const produce = vi.hoisted(() => vi.fn());
vi.mock('@/services/outreachCopilot/igosProducer', () => ({ produceInformationGain: produce }));
const { useOutreachInformationGain } = await import('@/components/Domain/backlinkChecker/useOutreachInformationGain');

const page = (patch: Partial<CrawledPageSummary> = {}): CrawledPageSummary => CrawledPageSummarySchema.parse({
  url: 'https://site.test/a', final_url: 'https://site.test/a', redirect_chain: [], depth: 0, http_status: 200, response_time_ms: 10,
  indexability_status: 'Eligible from this response only', body_truncated: false, word_count: 300, schema_types: [],
  schema_syntax_errors: 0, hreflangs: [], h1_count: 1, internal_link_count: 0, external_link_count: 0, links: [], images: [],
  issues_count: 0, issues: [], semantic_excerpts: ['Sleep and health.'], ...patch,
});
const base = { projectId: 'p1', site: 'https://site.test', competitors: ['a.test', 'b.test', 'c.test'] };
const report = { competitors: base.competitors, opportunities: [] } as unknown as BacklinkGapReport;
const deferred = () => { let resolve!: (value: unknown) => void; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

describe('information gain request identity (#143)', () => {
  beforeEach(() => { produce.mockReset(); });

  it('keeps entity and paragraph boundaries distinct', () => {
    const key = (patch: Partial<CrawledPageSummary>) => informationGainRequestKey({ ...base, pages: [page(patch)] });
    expect(key({ semantic_terms: ['sleep,health'] })).not.toBe(key({ semantic_terms: ['sleep', 'health'] }));
    expect(key({ semantic_excerpts: ['alpha/beta'] })).not.toBe(key({ semantic_excerpts: ['alpha', 'beta'] }));
    expect(key({ semantic_terms: ['x'] })).toBe(key({ semantic_terms: ['x'] }));
    expect(informationGainRequestKey({ ...base, pages: [] })).toContain('null');
    expect(informationGainTarget([page({ semantic_excerpts: [] })])).toBeNull();
  });

  it('starts a new request when only entities change and drops the stale deferred result', async () => {
    const first = deferred(); const second = deferred();
    produce.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook((props: { pages: CrawledPageSummary[] }) => useOutreachInformationGain({ ...base, report, pages: props.pages }), {
      initialProps: { pages: [page({ semantic_terms: ['sleep,health'] })] },
    });
    rerender({ pages: [page({ semantic_terms: ['sleep', 'health'] })] });
    expect(produce).toHaveBeenCalledTimes(2);
    await act(async () => { first.resolve({ projectId: 'p1', site: base.site, report: null, source: null }); });
    expect(result.current).toBeNull();
    await act(async () => { second.resolve({ projectId: 'p1', site: 'second', report: null, source: null }); });
    expect(result.current?.site).toBe('second');
  });

  it('does not refetch for a new array with identical content, but does for new paragraph boundaries', async () => {
    produce.mockResolvedValue(null);
    const { rerender } = renderHook((props: { pages: CrawledPageSummary[] }) => useOutreachInformationGain({ ...base, report, pages: props.pages }), {
      initialProps: { pages: [page({ semantic_excerpts: ['alpha/beta'] })] },
    });
    rerender({ pages: [page({ semantic_excerpts: ['alpha/beta'] })] });
    expect(produce).toHaveBeenCalledTimes(1);
    rerender({ pages: [page({ semantic_excerpts: ['alpha', 'beta'] })] });
    expect(produce).toHaveBeenCalledTimes(2);
    await act(async () => {});
  });

  it('stays unavailable without a project and swallows producer failures', async () => {
    produce.mockImplementation(async () => { throw new Error('boom'); });
    const { result, rerender } = renderHook((props: { projectId: string | null }) => useOutreachInformationGain({ ...base, projectId: props.projectId, report, pages: [page()] }), { initialProps: { projectId: null as string | null } });
    expect(produce).not.toHaveBeenCalled();
    rerender({ projectId: 'p1' });
    await act(async () => {});
    expect(produce).toHaveBeenCalledTimes(1);
    expect(result.current).toBeNull();
  });
});
