import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { AuthorityPillars } from '@/components/Domain/crawlResults/authority/AuthorityPillars';
import { CannibalizationPanel } from '@/components/Domain/crawlResults/authority/CannibalizationPanel';
import { CoverageMap } from '@/components/Domain/crawlResults/authority/CoverageMap';
import { GapBriefPanel } from '@/components/Domain/crawlResults/authority/GapBriefPanel';
import { ReferenceMapPanel } from '@/components/Domain/crawlResults/authority/ReferenceMapPanel';
import { SubtopicDrilldown } from '@/components/Domain/crawlResults/authority/SubtopicDrilldown';
import { pillarName } from '@/components/Domain/crawlResults/authority/authorityText';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const pages = ownSite();
const startUrl = `https://${OWN_HOST}/`;
const report = () => buildAuthorityReport(pages, startUrl, ownReport(pages), { taxonomy: referenceTaxonomy(pages), now: NOW });

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); });

describe('coverage100 topical authority pieces', () => {
  it('covers null pillar values, names and rows without optional coverage details', () => {
    const base = report();
    render(<AuthorityPillars report={{ ...base, pillars: { ...base.pillars, tcr: null, cdes: null }, warnings: ['empty-authority'], templateDuplicates: [] }} />);
    expect(screen.getByTestId('authority-pillar-tcr').textContent).toContain('not measurable');
    expect(pillarName(i18n.t.bind(i18n) as never, 'topic', 'Topic')).toBe('Topic');
    const map = { coverage: [{ pillar: 'general', subtopicId: 'g', label: 'General', status: 'missing_gap', gap: undefined, coverage: 0, similarity: 0 }], pillarCoverage: [{ id: 'general', label: 'General', coveragePct: 0 }] };
    render(<CoverageMap report={map as never} onSelect={() => undefined} />);
    expect(screen.getByText('General')).toBeTruthy();
  });

  it('reports an empty draft overlap and renders a brief with default dependencies', async () => {
    const base = report();
    const emptyView = render(<CannibalizationPanel report={{ ...base, cannibalization: [] }} pages={pages} startUrl={startUrl} />);
    fireEvent.change(screen.getByLabelText('Draft title'), { target: { value: 'Quantum' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check overlap' }));
    await waitFor(() => expect(screen.getByText(/No overlap above/)).toBeTruthy());
    emptyView.unmount();
    const withCannibal = render(<CannibalizationPanel report={{ ...base, cannibalization: [{ canonical: 'https://coffee.test/c1', urls: ['https://coffee.test/c1', 'https://coffee.test/c2'], similarity: 85, sharedEntitiesPct: 70, edges: [{ from: 'https://coffee.test/c1', to: 'https://coffee.test/c2', similarity: 85, basis: 'content' }] }] }} pages={pages} startUrl={startUrl} />);
    expect(screen.getByText(i18n.t('authority.cannibal.steps'))).toBeTruthy();
    withCannibal.unmount();
    const overlapPage = {
      url: 'https://coffee.test/existing', final_url: 'https://coffee.test/existing', title: 'Quantum',
      semantic_excerpts: ['coffee espresso roast bean grinder brew barista crema'], links: [], http_status: 200, content_type: 'text/html', word_count: 100,
    };
    render(<CannibalizationPanel report={{ ...base, cannibalization: [] }} pages={[overlapPage] as never} startUrl={startUrl} />);
    fireEvent.change(screen.getByLabelText('Draft title'), { target: { value: 'Quantum' } });
    fireEvent.change(screen.getByLabelText('Draft text'), { target: { value: 'coffee espresso roast bean grinder brew barista crema' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check overlap' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('100%'));
    const row = { ...base.coverage[0], coverage: 0 as const };
    render(<GapBriefPanel report={base} row={row} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate AI brief' }));
    await waitFor(() => expect(/Connect an AI provider|AI returned/.test(screen.getByRole('alert').textContent ?? '')).toBe(true));
  });

  it('uses the source fallback and renders a no-page subtopic drilldown', () => {
    const base = report();
    const taxonomy = { ...referenceTaxonomy(pages)!, source: '' };
    const onCancel = vi.fn();
    const onClear = vi.fn();
    const refView = render(<ReferenceMapPanel taxonomy={null} state={{ running: true, progress: { phase: 'crawl', domain: 'x.com', done: 1, total: 2 }, failure: null, error: null }} onBuild={() => undefined} onCancel={onCancel} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('authority.reference.cancel') }));
    expect(onCancel).toHaveBeenCalled();
    refView.unmount();
    const clearView = render(<ReferenceMapPanel taxonomy={taxonomy} state={{ running: false, progress: null, failure: { status: 'unavailable', reason: 'serp_empty', error: 'err' }, error: 'err' }} onBuild={() => undefined} onCancel={onCancel} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('authority.reference.clear') }));
    expect(onClear).toHaveBeenCalled();
    clearView.unmount();
    const row = { ...base.coverage[0], bestUrl: undefined, coverage: 0 as const, entitiesPresent: [], entitiesMissing: [], questionsMissing: [] };
    const drillEmpty = render(<SubtopicDrilldown report={base} row={row} onBack={() => undefined} />);
    expect(screen.getByText('No page covers this sub-topic yet.')).toBeTruthy();
    drillEmpty.unmount();
    const onBack = vi.fn();
    const fullRow = { ...base.coverage[0], bestUrl: 'https://coffee.test/p1', depth: 85, entitiesPresent: ['E1'], entitiesMissing: ['E2'], questionsMissing: ['Q1'] };
    const drillReport = { ...base, silo: { audits: { 'https://coffee.test/p1': { pillarUrl: 'https://coffee.test/pillar', linksToPillar: false, inbound: 1, bleedTargets: ['https://bleed.test/'] } } } };
    const drillFull = render(<SubtopicDrilldown report={drillReport as never} row={fullRow} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('authority.drill.back') }));
    expect(onBack).toHaveBeenCalled();
    drillFull.unmount();
    const onSelect = vi.fn();
    render(<CoverageMap report={{ coverage: [{ pillar: 'p1', subtopicId: 's1', label: 'S1', status: 'missing_gap', gap: 'missing', coverage: 0, similarity: 0 }], pillarCoverage: [{ id: 'p1', label: 'Pillar 1', coveragePct: 0 }] } as never} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('authority.coverage.filter.cannibalized', { count: 0 }) }));
    expect(screen.getByText(i18n.t('authority.coverage.empty'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('authority.coverage.filter.gaps', { count: 1 }) }));
    fireEvent.click(screen.getByRole('button', { name: /S1/ }));
    expect(onSelect).toHaveBeenCalledWith('s1');
    render(<GapBriefPanel report={{ ...base, taxonomy: null }} row={{ ...row, coverage: 0 as const }} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Generate AI brief' }).at(-1)!);
  });
});
