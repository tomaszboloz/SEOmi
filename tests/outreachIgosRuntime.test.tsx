import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { createCrawlPageFixture } from './fixtures/crawl';
import { BacklinkOutreachSection } from '@/components/Domain/backlinkChecker/BacklinkOutreachSection';
import { useOutreachIgos } from '@/components/Domain/backlinkChecker/useOutreachIgos';
import { buildOutreachIgos } from '@/services/outreachCopilot/igos';
import { belongsToSite, boundedOutreachText, outreachTokens, pageTitle, pageUrl, passages, targetChunks } from '@/services/outreachCopilot/igosText';
import type { BacklinkGapReport, CrawledPageSummary } from '@/types';
import { fetchSource } from '@/services/offPage/sourceTransport';
import * as registry from '@/services/embeddings/registry';
vi.mock('@/services/offPage/sourceTransport', () => ({ fetchSource: vi.fn() }));

const report: BacklinkGapReport = { target: 'site.test', competitors: ['a.test', 'b.test', 'c.test'], include_subdomains: true, rows_scanned: 3, total_rows: 3, opportunities: [{ referring_domain: 'outreach.test', target_backlinks: 0, max_competitor_spam_score: null, competitor_backlinks: [{ domain: 'a.test', backlinks: 1, rank: 80 }, { domain: 'b.test', backlinks: 1, rank: null }, { domain: 'c.test', backlinks: 1, rank: 60 }] }] };
const page = (patch: Partial<CrawledPageSummary> = {}): CrawledPageSummary => createCrawlPageFixture({ url: 'https://site.test/guide', final_url: 'https://site.test/guide', title: 'Original guide', semantic_terms: ['topic', 'evidence'], ...patch });
const text = 'Topic evidence research with original methods and practical results. '.repeat(8);
const competitor = (domain: string, value = text, rank: number = 70) => ({ sourceUrl: `https://${domain}/`, rank, availability: 'ok', text: value, fetchedAt: '2026-10-24T00:00:00Z' });
const input = (patch: Partial<CrawledPageSummary> = {}) => ({ site: 'https://site.test', targetPages: [{ source: page(patch), text }], competitorSources: [competitor('a.test'), competitor('b.test'), competitor('c.test')] });

describe('outreach IGOS producer', () => {
  it('keeps text, URL and page metadata bounded, handles empty tokens, and fails closed', () => {
    expect(boundedOutreachText('  abc  ')).toBe('abc');
    expect(boundedOutreachText('abcdef', 3)).toBe('abc');
    expect(outreachTokens('...')).toEqual([]);
    expect(pageUrl(page())).toBe('https://site.test/guide');
    expect(pageUrl(page({ final_url: '', url: 'https://site.test/guide' }))).toBe('https://site.test/guide');
    expect(pageUrl({ ...page(), final_url: undefined as any, url: undefined as any })).toBe('');
    expect(pageUrl(page({ final_url: '', url: 'mailto:a' }))).toBe('');
    expect(pageTitle(page())).toBe('Original guide');
    expect(pageTitle(page({ title: '', heading_texts: { h1: [], h2: ['H2'], h3: [] } }))).toBe('H2');
    expect(pageTitle(page({ title: '', heading_texts: { h1: [], h2: [], h3: [] } }))).toBe('');
    expect(belongsToSite('https://blog.site.test/x', 'https://site.test')).toBe(true);
    expect(belongsToSite('https://other.test/x', 'https://site.test') || belongsToSite('bad', 'https://site.test')).toBe(false);
    expect(targetChunks(page({ rag_sections: [{ heading: '', level: 2, paragraphs: ['One'], tables: 0, ordered_lists: 0, unordered_lists: 0, definition_lists: 0 }] }), text)[0].heading).toBeNull();
    expect(targetChunks(page(), 'One\n\nTwo')).toHaveLength(2);
    expect(passages('x'.repeat(2_100))).toHaveLength(3);
    expect(passages('word_without_space_'.repeat(80))).toHaveLength(2);
    expect(passages(`${'a'.repeat(1500)} ${'b'.repeat(500)}`)).toHaveLength(3);
    expect(passages(`hello ${' '.repeat(2500)} world ${'x'.repeat(500)}`)).toHaveLength(3); expect(passages('   ')).toEqual([]);
  });

  it('builds a real report and an IGOS source with novelty evidence, prioritizing longest text and finite ranks', async () => {
    const shortPage = { source: page({ url: 'https://site.test/short', final_url: 'https://site.test/short', title: 'Short' }), text: 'Short text' };
    const longPage = { source: page({ semantic_terms: ['novelty-x', 'method-y'] }), text: `${text} novel experiments and proprietary benchmarks.` };
    const result = await buildOutreachIgos({ ...input(), targetPages: [shortPage, longPage], competitorSources: [competitor('a.test', text, Number.NaN), competitor('b.test'), competitor('c.test')] });
    expect(result.report?.status).toBe('ready');
    expect(result.sourceCandidates[0]).toMatchObject({ title: 'Original guide', url: 'https://site.test/guide', provenance: 'igos' });
    expect(result.sourceCandidates[0].evidence?.novelEntities.length).toBeGreaterThan(0);
  });

  it('rejects identical target and competitors as having no unique candidate despite a score', async () => {
    const sameText = 'Consensus facts shared equally across all sources without deviation.';
    const result = await buildOutreachIgos({
      site: 'https://site.test',
      targetPages: [{ source: page({ title: 'Echo Page', semantic_terms: ['consensus', 'facts'] }), text: sameText }],
      competitorSources: [competitor('a.test', sameText), competitor('b.test', sameText), competitor('c.test', sameText)],
    });
    expect(result.report).not.toBeNull();
    expect(result.report?.novelEntities).toHaveLength(0);
    expect(result.sourceCandidates).toHaveLength(0);
  });

  it('returns unavailable when target, site, or comparable source data is missing or embedding fails', async () => {
    for (const bad of [{ site: '' }, { targetPages: [] }, { competitorSources: [competitor('a.test', '')] },
      { competitorSources: [{ ...competitor('a.test'), availability: 'unavailable' }] },
      { competitorSources: [{ ...competitor('a.test'), sourceUrl: 'javascript:alert(1)' }] },
      { targetPages: [{ source: page(), text: '\0\0' }] }]) {
      expect((await buildOutreachIgos({ ...input(), ...bad } as any)).report).toBeNull();
    }
    const spy = vi.spyOn(registry, 'createProvider');
    spy.mockReturnValueOnce({ id: 'm', model: 'm', embed: vi.fn().mockRejectedValue(new Error('fail')) });
    expect((await buildOutreachIgos(input())).report).toBeNull();
    spy.mockRestore();
  });

  it('keeps the report while withholding a draft source without a title', async () => {
    const result = await buildOutreachIgos(input({ title: '', heading_texts: { h1: [], h2: [], h3: [] } }));
    expect(result.report).toBeTruthy();
    expect(result.sourceCandidates).toEqual([]);
  });
});

const Harness = ({ currentReport, site, pages, projectId }: { currentReport: BacklinkGapReport | null; site: string; pages: Array<{ source: CrawledPageSummary; text: string }>; projectId?: string }) => {
  const state = useOutreachIgos(currentReport, site, pages, projectId);
  return <BacklinkOutreachSection report={currentReport} site={site} igosReport={state.report} sourceCandidates={state.sourceCandidates} />;
};

describe('outreach IGOS runtime wiring', () => {
  it('passes the producer result through the panel into a draft and handles fetch error and authority null', async () => {
    vi.mocked(fetchSource).mockImplementation(async (source) => ({
      ...source, authority: null, availability: 'ok', text: `${text} baseline facts.`, fetchedAt: '2026-10-24T00:00:00Z',
    }));
    const { rerender } = render(<Harness currentReport={report} site="https://site.test" pages={[{ source: page({ semantic_terms: ['novel-metric'] }), text: `${text} novel proprietary method.` }]} />);
    await waitFor(() => expect(screen.getByTestId('outreach-draft').textContent).toContain('Original guide'));
    vi.mocked(fetchSource).mockRejectedValueOnce(new Error('network offline'));
    rerender(<Harness currentReport={{ ...report, target: 'site-err.test' }} site="https://site.test" pages={[{ source: page(), text }]} />);
    await waitFor(() => expect(screen.getByTestId('outreach-source-status').textContent).toContain('No verified IGOS source'));
  });

  it('cuts flash on same-length tail edit and same-count rank refresh, ignoring old deferred', async () => {
    vi.mocked(fetchSource).mockImplementation(async (source) => ({
      ...source, availability: 'ok', text: `${text} baseline facts.`, fetchedAt: '2026-10-24T00:00:00Z',
    }));
    const prefix32 = 'Topic evidence research with met';
    const textA = `${prefix32}hods and practical A. `.repeat(5);
    const textB = `${prefix32}hods and practical B. `.repeat(5);
    const { rerender } = render(<Harness currentReport={report} site="https://site.test" pages={[{ source: page({ title: 'Guide Alpha', semantic_terms: ['novel-metric'] }), text: textA }]} />);
    await waitFor(() => expect(screen.getByTestId('outreach-draft').textContent).toContain('Guide Alpha'));

    let resolveB: (val: any) => void = () => {};
    const deferredB = new Promise((resolve) => { resolveB = resolve; });
    vi.mocked(fetchSource).mockImplementation((source) => (source.sourceUrl.includes('a.test') ? deferredB as any : Promise.resolve({ ...source, availability: 'ok', text, fetchedAt: '2026-10-24T00:00:00Z' })));

    // Regression 1: identical first 32 chars and length, but changed tail novelty (also tests missing title, final_url, semantic_terms, heading):
    rerender(<Harness currentReport={report} site="https://site.test" pages={[{ source: page({ title: undefined as any, final_url: undefined as any, semantic_terms: undefined, rag_sections: [{ heading: undefined as any, level: 2, paragraphs: ['P'], tables: 0, ordered_lists: 0, unordered_lists: 0, definition_lists: 0 }] }), text: textB }]} />);
    expect(screen.queryByTestId('outreach-draft')).toBeNull();
    expect(screen.queryByText(/Guide Alpha/)).toBeNull();

    // Regression 2: changed semantic_terms or rag_sections cuts draft synchronously:
    for (const diffPage of [{ semantic_terms: ['diff-term'] }, { rag_sections: [{ heading: 'H', level: 2, paragraphs: ['P'], tables: 0, ordered_lists: 0, unordered_lists: 0, definition_lists: 0 }] }]) {
      rerender(<Harness currentReport={report} site="https://site.test" pages={[{ source: page(diffPage), text: textB }]} />);
      expect(screen.queryByTestId('outreach-draft')).toBeNull();
    }

    // Regression 3: competitor rank change, target change, or project switch with identical prompt:
    for (const diffReport of [{ opportunities: [{ ...report.opportunities[0], competitor_backlinks: [{ domain: 'a.test', backlinks: 1, rank: 99 }] }] }, { target: 'other.test' }]) {
      rerender(<Harness currentReport={{ ...report, ...diffReport }} site="https://site.test" pages={[{ source: page({ title: 'Guide Beta' }), text: textB }]} />);
      expect(screen.queryByTestId('outreach-draft')).toBeNull();
    }
    rerender(<Harness currentReport={report} site="https://site.test" pages={[{ source: page({ title: 'Guide Beta' }), text: textB }]} projectId="project-b" />);
    expect(screen.queryByTestId('outreach-draft')).toBeNull();

    // Deferred resolve on aborted effect tests line 84 !aborted falsy branch:
    await act(async () => { resolveB({ sourceUrl: 'https://a.test', authority: 80, availability: 'ok', text, fetchedAt: '2026-10-24T00:00:00Z' }); });
    expect(screen.queryByText('Guide Alpha')).toBeNull();

    // Deferred reject on aborted effect tests line 87 !aborted falsy branch:
    let rejectC: (err: any) => void = () => {};
    vi.mocked(fetchSource).mockImplementation((s) => (s.sourceUrl.includes('a.test') ? new Promise((_, r) => { rejectC = r; }) as any : Promise.resolve({ ...s, availability: 'ok', text, fetchedAt: '2026-10-24T00:00:00Z' })));
    rerender(<Harness currentReport={report} site="https://site.test" pages={[]} />);
    await act(async () => { rejectC(new Error('aborted-after-unmount')); });

    for (const emptyArgs of [['   '], [null]]) {
      rerender(<Harness currentReport={emptyArgs[0] === null ? null : report} site={emptyArgs[0] ?? 'https://site.test'} pages={[{ source: page(), text }]} />);
      expect(screen.queryByTestId('outreach-draft')).toBeNull();
    }
  });
});
