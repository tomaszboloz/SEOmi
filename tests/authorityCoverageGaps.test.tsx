import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { AuthorityBenchmark } from '@/components/Domain/crawlResults/authority/AuthorityBenchmark';
import { host } from '@/components/Domain/crawlResults/authority/authorityText';
import { DEFAULT_VIEW, viewRows } from '@/components/Domain/crawlResults/authority/coverageView';
import { CannibalizationPanel } from '@/components/Domain/crawlResults/authority/CannibalizationPanel';
import { useTopicalAuthority } from '@/hooks/useTopicalAuthority';
import { buildAuthorityReport, gscEvidenceFor, uniqueTermsByUrl, type CannibalGroup, type SubtopicCoverage } from '@/services/topicalAuthority';
import { gatedSiteFocus } from '@/services/topicalAuthority/context';
import { buildSiteFocusReport, type FocusPage } from '@/services/siteFocus';
import { buildTopicalBenchmark, type ReferenceOutcome } from '@/services/topicalAuthorityReference';
import { compareRows } from '@/services/topicalAuthorityReference/benchmark';
import { COMPETITORS, NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const pages = ownSite();
const START = `https://${OWN_HOST}/`;
beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('stable ordering ties (#60 GEM-60-05)', () => {
  const row = (id: string, patch: Partial<SubtopicCoverage> = {}) => ({ subtopicId: id, pillar: 'p', label: 'same', importance: 0.5, similarity: 0.5, status: 'covered', urls: [], ...patch }) as SubtopicCoverage;
  const ids = (sort: 'importance' | 'similarity' | 'label', rows: SubtopicCoverage[]) => viewRows(rows, 'p', { ...DEFAULT_VIEW, sort, filter: 'all' }).map((item) => item.subtopicId);
  it('breaks ties by sub-topic ID in both directions and keeps equal IDs equal', () => {
    const rows = [row('b'), row('c'), row('a'), row('a')];
    for (const sort of ['importance', 'similarity', 'label'] as const) expect(ids(sort, rows)).toEqual(['a', 'a', 'b', 'c']);
    expect(ids('importance', [row('z'), row('y')])).toEqual(['y', 'z']);
  });
  it('shows a path or the raw text for unparsable or empty paths', () => {
    expect(host('https://x.test/a?b=1')).toBe('/a?b=1');
    expect(host('javascript:')).toBe('/');
    expect(host('not a url')).toBe('not a url');
  });
});

describe('benchmark provenance without a source label', () => {
  it('falls back to a dash', () => {
    const taxonomy = referenceTaxonomy(pages)!;
    const own = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy, now: NOW });
    const bench = buildTopicalBenchmark(own, OWN_HOST, COMPETITORS, taxonomy, NOW)!;
    render(<AuthorityBenchmark benchmark={{ ...bench, source: '' }} />);
    expect(document.body.textContent).toContain('—');
  });
  it('sorts an unmeasured own TAS after scored rows', () => {
    const taxonomy = referenceTaxonomy(pages)!;
    const own = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: null, now: NOW });
    const rows = buildTopicalBenchmark({ ...own, tas: null }, OWN_HOST, COMPETITORS, taxonomy, NOW)!.rows;
    expect(rows.at(-1)?.isOwn).toBe(true);
    expect(rows.slice(0, -1).every((item) => item.tas !== null)).toBe(true);
  });
  it('orders rows by TAS with unmeasured last, then own row, then domain', () => {
    const row = (domain: string, tas: number | null, isOwn = false) => ({ domain, tas, isOwn, sfs: 50, quadrant: null });
    const sorted = [row('b.test', null), row('a.test', 40), row('own.test', 40, true), row('c.test', null), row('d.test', 90)].sort(compareRows).map((item) => item.domain);
    expect(sorted).toEqual(['d.test', 'own.test', 'a.test', 'b.test', 'c.test']);
    expect(compareRows(row('z', null), row('a', 5))).toBeGreaterThan(0);
    expect(compareRows(row('a', 5), row('z', null))).toBeLessThan(0);
  });
});

describe('draft overlap form', () => {
  it('runs the check on submit', () => {
    const report = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: null, now: NOW });
    render(<CannibalizationPanel report={report} pages={pages} startUrl={START} />);
    fireEvent.change(screen.getByLabelText('URL of the page this draft updates (optional)'), { target: { value: `${START}espresso` } });
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Espresso machines' } });
    fireEvent.submit(screen.getByLabelText(/title/i).closest('form')!);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});

describe('GSC evidence ties', () => {
  const A = 'https://shop.test/a'; const B = 'https://shop.test/b'; const C = 'https://shop.test/c';
  const group: CannibalGroup = { urls: [A, B, C], canonical: A, similarity: 90, sharedEntitiesPct: 50, edges: [] };
  const r = (query: string, page: string, clicks: number, impressions: number) => ({ query, page, clicks, impressions, ctr: 0, position: 3 });
  it('orders equal clicks by impressions, then URL, and equal queries alphabetically', () => {
    const data = { query_pages: [r('zz', C, 2, 10), r('zz', A, 2, 10), r('zz', B, 2, 30), r('aa', B, 1, 10), r('aa', C, 1, 10), r('aa', A, 1, 10), r('mm', A, 1, 50), r('mm', B, 1, 40)] };
    const evidence = gscEvidenceFor(group, data);
    expect(evidence.queries.map((item) => item.query)).toEqual(['mm', 'zz', 'aa']);
    expect(evidence.queries[1].pages.map((item) => item.url)).toEqual([B, A, C]);
    expect(evidence.queries[2].pages.map((item) => item.url)).toEqual([A, B, C]);
    expect(evidence.leader).toBe(B);
  });
  it('breaks a full tie on URL and leader ties on impressions', () => {
    const tie = gscEvidenceFor(group, { query_pages: [r('q', C, 1, 5), r('q', B, 1, 5), r('q', A, 1, 5)] });
    expect(tie.leader).toBe(A);
    const imp = gscEvidenceFor(group, { query_pages: [r('q', A, 1, 5), r('q', B, 1, 9)] });
    expect(imp.leader).toBe(B);
    const rev = gscEvidenceFor(group, { query_pages: [r('q', B, 1, 5), r('q', A, 1, 5)] });
    expect(rev.leader).toBe(A);
    const asc = gscEvidenceFor(group, { query_pages: [r('q', A, 1, 5), r('q', B, 1, 5)] });
    expect(asc.leader).toBe(A);
    const swapped = gscEvidenceFor(group, { query_pages: [r('q1', B, 3, 30), r('q1', A, 1, 10), r('q2', A, 3, 30), r('q2', B, 1, 10)] });
    expect(swapped.leader).toBe(A);
    const ties = gscEvidenceFor(group, { query_pages: [r('q2', A, 1, 5), r('q2', B, 1, 5), r('q3', A, 1, 5), r('q3', B, 1, 5), r('q1', A, 1, 5), r('q1', B, 1, 5)] });
    expect(ties.queries.map((item) => item.query)).toEqual(['q1', 'q2', 'q3']);
  });
  it('uses the raw term when a surface is empty and orders unique terms by weight then name', () => {
    const page = (url: string, terms: Array<[string, string, number]>) => ({ url, focus_terms: terms.map(([term, surface, weight]) => ({ term, surface, count: 1, weight })) }) as unknown as FocusPage;
    const out = uniqueTermsByUrl(group, [page(A, [['zeta', '', 5], ['alpha', 'alpha', 5], ['beta', 'beta', 5], ['gamma', 'gamma', 9]]), page(B, [['x', 'x', 1]])], 'en');
    expect(out[A]).toEqual(['gamma', 'alpha', 'beta', 'zeta']);
  });
});

describe('gated model keeps goal and brand', () => {
  it('re-requests the business goal and brand dictionary', () => {
    const report = buildSiteFocusReport(pages, START, { now: NOW, language: 'en', businessGoal: 'Sell espresso machines to home baristas', brand: { aliases: ['Coffee Test'], competitors: [], exceptions: [] } });
    expect(report.coreTopic.businessGoal).toBeTruthy();
    expect(report.model.brand).toBeTruthy();
    const gated = gatedSiteFocus(pages, START, report);
    expect(gated.report.coreTopic.businessGoal?.input).toBe(report.coreTopic.businessGoal?.input);
    expect(gated.report.model.brand).toBeTruthy();
  });
});

describe('reference build without a project', () => {
  it('still builds the map and does not store it', async () => {
    const outcome: ReferenceOutcome = { status: 'ok', taxonomy: referenceTaxonomy(pages)!, competitors: COMPETITORS };
    const runner = vi.fn().mockResolvedValue(outcome);
    const hook = renderHook(() => useTopicalAuthority({ pages, startUrl: START, sfs: ownReport(pages), runner }));
    await act(async () => { await hook.result.current.build(); });
    expect(runner).toHaveBeenCalledOnce();
    expect(Object.keys(localStorage).some((key) => key.includes('authority_taxonomy'))).toBe(false);
  });
});
