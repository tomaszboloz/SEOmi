import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { AuthorityPillars } from '@/components/Domain/crawlResults/authority/AuthorityPillars';
import { CannibalizationPanel } from '@/components/Domain/crawlResults/authority/CannibalizationPanel';
import { SubtopicDrilldown } from '@/components/Domain/crawlResults/authority/SubtopicDrilldown';
import { barFor, host, pillarName, toneFor } from '@/components/Domain/crawlResults/authority/authorityText';
import { useTopicalAuthority, defaultReferenceRunner } from '@/hooks/useTopicalAuthority';
import { buildAuthorityReport, buildContext, checkDraftOverlap, eligiblePages, findCannibalization, type SubtopicCoverage } from '@/services/topicalAuthority';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: vi.fn().mockResolvedValue(false) }));

const pages = ownSite();
const START = `https://${OWN_HOST}/`;
const sfs = () => ownReport(pages);
const full = () => buildAuthorityReport(pages, START, sfs(), { taxonomy: referenceTaxonomy(pages), now: NOW });

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });

describe('helpers', () => {
  it('maps scores to tones and bars on every band', () => {
    [95, 80, 65, 45, 10].forEach((value) => { expect(toneFor(value)).toMatch(/text-/); expect(barFor(value)).toMatch(/bg-/); });
    expect(toneFor(null)).toBe('text-slate-500');
    expect(barFor(null)).toBe('bg-slate-700');
    expect(host('not a url')).toBe('not a url');
    expect(host('https://x.test')).toBe('/');
    expect(pillarName(i18n.t.bind(i18n) as never, 'general', 'general')).toBe('General topics');
  });
});

describe('panels', () => {
  it('lists every warning on the pillar card', () => {
    const base = full();
    render(<AuthorityPillars report={{ ...base, warnings: ['empty-authority', 'template-duplicates', 'no-dates', 'no-links', 'no-pillars'], templateDuplicates: ['a', 'b'] }} />);
    expect(screen.getAllByRole('status')).toHaveLength(4);
  });

  it('shows the cannibalization plan and a hit list for a overlapping draft', () => {
    const report = full();
    render(<CannibalizationPanel report={report} pages={pages} startUrl={START} language="en" />);
    expect(screen.getByText(/Keep:/)).toBeTruthy();
    const body = 'coffee espresso roast bean grinder brew barista crema extraction filter arabica kettle';
    fireEvent.change(screen.getByLabelText('Draft title'), { target: { value: 'Espresso machines' } });
    fireEvent.change(screen.getByLabelText('Draft text'), { target: { value: body } });
    fireEvent.submit(screen.getByRole('button', { name: 'Check overlap' }).closest('form') as HTMLFormElement);
    expect(screen.getByRole('status')).toBeTruthy();
    render(<CannibalizationPanel report={{ ...report, cannibalization: [] }} pages={pages} startUrl={START} />);
    expect(screen.getAllByText('No pages compete for the same search intent.')).toHaveLength(1);
  });

  it('audits links of a covered sub-topic and reports a missing page', () => {
    const report = full();
    const row = report.coverage.find((item) => item.bestUrl) as SubtopicCoverage;
    const url = row.bestUrl as string;
    const withIssues = { ...report, silo: { ...report.silo, audits: { ...report.silo.audits, [url]: { pillarUrl: `https://${OWN_HOST}/`, linksToPillar: false, inbound: 0, bleedTargets: [`https://${OWN_HOST}/off`] } } } };
    const view = render(<SubtopicDrilldown report={withIssues} row={{ ...row, depth: undefined }} onBack={() => undefined} />);
    expect(screen.getByText(/No link to the pillar page/)).toBeTruthy();
    expect(screen.getByText(/almost an orphan page/)).toBeTruthy();
    expect(screen.getByText(/Links to the off-topic page/)).toBeTruthy();
    view.unmount();
    const healthy = { ...report, silo: { ...report.silo, audits: { [url]: { linksToPillar: true, inbound: 5, bleedTargets: [] } } } };
    render(<SubtopicDrilldown report={healthy} row={row} onBack={() => undefined} />);
    expect(screen.getByText('Internal linking looks healthy.')).toBeTruthy();
    render(<SubtopicDrilldown report={report} row={{ ...row, bestUrl: undefined, coverage: 1 }} onBack={() => undefined} />);
    expect(screen.getByText('No page covers this sub-topic yet.')).toBeTruthy();
  });
});

describe('engine edges', () => {
  it('handles drafts with empty text, canonical tie-breaks and pages without H1', () => {
    expect(checkDraftOverlap({ title: ' ', body: '' }, pages, START)).toEqual([]);
    expect(checkDraftOverlap({ title: 'x', body: '' }, [], START)).toEqual([]);
    const context = buildContext(pages, START, sfs());
    const eligible = eligiblePages(context);
    const inbound = new Map(eligible.map((entry, index) => [entry.url, index]));
    const groups = findCannibalization(eligible, context, full().coverage, inbound);
    expect(groups.length).toBeGreaterThan(0);
    const solo = findCannibalization(eligible.slice(0, 1), context, [], new Map());
    expect(solo).toEqual([]);
    const strange = findCannibalization(eligible, context, [{ ...full().coverage[0], coverage: 1, urls: ['https://elsewhere.test/x', eligible[0].url] }], new Map());
    expect(Array.isArray(strange)).toBe(true);
  });
});

describe('useTopicalAuthority', () => {
  const run = createCrawlRunFixture({ id: 'r1', startUrl: START, result: createCrawlResultFixture({ pages, start_url: START }) });
  it('returns nothing without a Site Focus report and rebuilds when the project changes', async () => {
    const { result, rerender } = renderHook((props: { projectId: string | null; sfsReport: ReturnType<typeof sfs> | null }) => useTopicalAuthority({ pages, startUrl: START, sfs: props.sfsReport, run, projectId: props.projectId }), { initialProps: { projectId: 'a1', sfsReport: null as ReturnType<typeof sfs> | null } });
    expect(result.current.report).toBeNull();
    await act(async () => { await result.current.build(); });
    expect(result.current.state.running).toBe(false);
    rerender({ projectId: 'a2', sfsReport: sfs() });
    expect(result.current.report?.tas).toBeNull();
    act(() => result.current.cancel());
    act(() => result.current.clear());
    expect(result.current.taxonomy).toBeNull();
    expect(typeof defaultReferenceRunner).toBe('function');
  });

  it('ignores a stale run when a new build starts', async () => {
    let first: (value: never) => void = () => undefined;
    const runner = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { first = resolve; })).mockResolvedValueOnce({ status: 'cancelled' });
    const { result } = renderHook(() => useTopicalAuthority({ pages, startUrl: START, sfs: sfs(), run, projectId: 'a3', runner }));
    act(() => { void result.current.build(); });
    await act(async () => { await result.current.build(); });
    await waitFor(() => expect(result.current.state.failure?.status).toBe('cancelled'));
    await act(async () => first({ status: 'unavailable', reason: 'no-pages' } as never));
    expect(result.current.state.failure?.status).toBe('cancelled');
  });
});
