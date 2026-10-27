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
import { readTasks } from '@/services/optimizationTasks/storage';
import { useProjectStore } from '@/stores/projectStore';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const pages = ownSite();
const startUrl = `https://${OWN_HOST}/`;
const report = () => buildAuthorityReport(pages, startUrl, ownReport(pages), { taxonomy: referenceTaxonomy(pages), now: NOW });

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); useProjectStore.setState({ activeProjectId: null }); });

describe('coverage100 topical authority pieces', () => {
  it('adds a real canonical redirect task from the mounted execution card', () => {
    const base = report();
    const canonical = 'https://coffee.test/canonical';
    const donor = 'https://coffee.test/donor';
    useProjectStore.setState({ activeProjectId: 'different-active-project' });
    render(<CannibalizationPanel report={{ ...base, tas: 74, cannibalization: [{ canonical, urls: [canonical, donor], edges: [], similarity: 90, sharedEntitiesPct: 80 }] }} pages={pages} startUrl={startUrl} projectId="authority-card" baselineScore={74} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.tasks.add') as string }));
    expect(readTasks('authority-card')[0]).toMatchObject({ kind: 'redirect-301', module: 'tas', url: donor, targetUrl: canonical, baselineScore: 74 });
    expect(readTasks('different-active-project')).toEqual([]);
  });

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
    render(<ReferenceMapPanel taxonomy={taxonomy} state={{ running: false, progress: null, failure: null, error: null }} onBuild={() => undefined} onCancel={() => undefined} onClear={() => undefined} />);
    expect(screen.getByText(/sub-topics in/)).toBeTruthy();
    const row = { ...base.coverage[0], bestUrl: undefined, coverage: 0 as const, entitiesPresent: [], entitiesMissing: [], questionsMissing: [] };
    render(<SubtopicDrilldown report={base} row={row} onBack={() => undefined} />);
    expect(screen.getByText('No page covers this sub-topic yet.')).toBeTruthy();
    render(<CoverageMap report={{ coverage: [{ pillar: 'general', subtopicId: 'g2', label: 'Gap', status: 'missing_gap', gap: 'missing', coverage: 1, similarity: 1 }], pillarCoverage: [{ id: 'general', label: 'General', coveragePct: 1 }] } as never} onSelect={() => undefined} />);
    expect(screen.getByText('Gap')).toBeTruthy();
    render(<GapBriefPanel report={{ ...base, taxonomy: null }} row={{ ...row, coverage: 0 as const }} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Generate AI brief' }).at(-1)!);
  });
});
