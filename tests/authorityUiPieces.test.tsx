import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { GapBriefPanel } from '@/components/Domain/crawlResults/authority/GapBriefPanel';
import { AuthorityBenchmark } from '@/components/Domain/crawlResults/authority/AuthorityBenchmark';
import { AuthorityHistoryChart } from '@/components/Domain/crawlResults/authority/AuthorityHistoryChart';
import { AuthorityMatrix } from '@/components/Domain/crawlResults/authority/AuthorityMatrix';
import { ReferenceMapPanel } from '@/components/Domain/crawlResults/authority/ReferenceMapPanel';
import { buildAuthorityReport, buildGapBrief } from '@/services/topicalAuthority';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: vi.fn().mockResolvedValue(false) }));

const pages = ownSite();
const START = `https://${OWN_HOST}/`;

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });

describe('Authority pieces', () => {
  const report = () => buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: referenceTaxonomy(pages), now: NOW });

  it('draws the matrix in every quadrant and handles RTL', async () => {
    const view = render(<AuthorityMatrix sfs={90} tas={90} quadrant="dominant_authority" />);
    expect(view.container.querySelector('[data-quadrant="dominant_authority"]')?.getAttribute('class')).toContain('emerald');
    view.rerender(<AuthorityMatrix sfs={50} tas={10} quadrant="unfocused_generalist" />);
    expect(screen.getByText(/Unfocused generalist/)).toBeTruthy();
    view.rerender(<AuthorityMatrix sfs={50} tas={null} quadrant={null} />);
    expect(screen.getByText('The matrix appears once TAS is calculated.')).toBeTruthy();
    await i18n.changeLanguage('ar');
    view.rerender(<AuthorityMatrix sfs={70} tas={70} quadrant="diluted_giant" />);
    expect(view.container.querySelector('svg')).toBeTruthy();
    await i18n.changeLanguage('en');
  });

  it('shows benchmark rows, pillars and insights, or an empty state', () => {
    const view = render(<AuthorityBenchmark benchmark={null} />);
    expect(screen.getByText(/Only real crawled data/)).toBeTruthy();
    view.rerender(<AuthorityBenchmark benchmark={{ builtAt: NOW, source: 's', ownRank: 1, rows: [{ domain: 'me.test', sfs: 80, tas: 70, quadrant: null, isOwn: true }, { domain: 'a.test', sfs: 70, tas: null, quadrant: null, isOwn: false }], pillars: [{ id: 'general', label: 'general', own: 50, competitors: { 'a.test': 20 } }, { id: 'p', label: 'Pour', own: 10, competitors: {} }], insights: [{ code: 'rank', params: { rank: 1, total: 2 } }] }} />);
    expect(screen.getByText('You rank 1 of 2 by TAS.')).toBeTruthy();
    expect(screen.getByText('General topics')).toBeTruthy();
    expect(screen.getByText('me.test (You)')).toBeTruthy();
  });

  it('draws the dual timeline with milestones, or waits for two analyses', async () => {
    const entry = (runId: string, sfs: number, tas: number | null, annotations: Array<{ code: 'cleanup'; params: { delta: number } }> = []) => ({
      snapshot: { runId, at: NOW, sfs, tas, tcr: null, cdes: null, silc: null, cvff: null, index: 0, quadrant: null, pageCount: 1, pillars: {} }, annotations,
    });
    const view = render(<AuthorityHistoryChart entries={[entry('a', 60, null)]} />);
    expect(screen.getByText(/after at least two full analyses/)).toBeTruthy();
    view.rerender(<AuthorityHistoryChart entries={[entry('a', 60, 40), entry('b', 72, 55, [{ code: 'cleanup', params: { delta: 12 } }]), entry('c', 75, null)]} />);
    expect(screen.getByRole('img', { name: /3 analyses/ })).toBeTruthy();
    expect(screen.getByText(/Cleanup: SFS rose by 12/)).toBeTruthy();
    await i18n.changeLanguage('ar');
    view.rerender(<AuthorityHistoryChart entries={[entry('a', 60, 40), entry('b', 72, 55)]} />);
    expect(view.container.querySelector('polyline')).toBeTruthy();
    await i18n.changeLanguage('en');
  });

  it('shows map status lines for every builder state', () => {
    const noop = () => undefined;
    const idle = { running: false, progress: null, failure: null, error: null };
    const view = render(<ReferenceMapPanel taxonomy={null} state={idle} onBuild={noop} onCancel={noop} onClear={noop} />);
    view.rerender(<ReferenceMapPanel taxonomy={referenceTaxonomy(pages)} state={idle} onBuild={noop} onCancel={noop} onClear={noop} />);
    expect(screen.getByText(/sub-topics in/)).toBeTruthy();
    view.rerender(<ReferenceMapPanel taxonomy={null} state={{ ...idle, running: true, progress: { phase: 'build', done: 0, total: 1 } }} onBuild={noop} onCancel={noop} onClear={noop} />);
    expect(screen.getByRole('status').textContent).toContain('Building the map');
    view.rerender(<ReferenceMapPanel taxonomy={null} state={{ ...idle, failure: { status: 'unavailable', reason: 'serp-failed', error: 'quota' } }} onBuild={noop} onCancel={noop} onClear={noop} />);
    expect(screen.getByRole('alert').textContent).toContain('quota');
  });

  it('generates an AI brief for a missing sub-topic and reports a missing provider', async () => {
    const taxonomy = referenceTaxonomy(pages)!;
    const extended = { ...taxonomy, subtopics: [...taxonomy.subtopics, { id: 'g-9', pillar: 'general', label: 'cold brew chemistry', keys: ['coldx'], importance: 0.9, entities: ['nitrogen'], questions: ['Why smooth?'] }] };
    const full = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: extended, now: NOW });
    const row = full.coverage.find((item) => item.subtopicId === 'g-9')!;
    expect(buildGapBrief(full, row).entities).toEqual(['nitrogen']);
    const view = render(<GapBriefPanel report={full} row={row} deps={() => ({ isConfigured: () => false, generateText: async () => '' })} />);
    expect(screen.getByText(/\/cold-brew-chemistry/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Generate AI brief' }));
    await waitFor(() => expect(screen.getByText(/Connect an AI provider/)).toBeTruthy());
    view.unmount();
    render(<GapBriefPanel report={full} row={row} deps={() => ({ isConfigured: () => true, generateText: async () => 'Outline text' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate AI brief' }));
    await waitFor(() => expect(within(screen.getByTestId('authority-ai-brief')).getByText('Outline text')).toBeTruthy());
    expect(report().tas).not.toBeNull();
  });

  it('renders brief error and empty states', async () => {
    const full = report();
    const row = { ...full.coverage[0], coverage: 0 as const, subtopicId: 'zz', entitiesMissing: [], questionsMissing: [] };
    const deps = (text: () => Promise<string>) => () => ({ isConfigured: () => true, generateText: text });
    const view = render(<GapBriefPanel report={full} row={row} deps={deps(async () => '')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate AI brief' }));
    await waitFor(() => expect(screen.getByText('The AI returned no text. Try again.')).toBeTruthy());
    view.unmount();
    render(<GapBriefPanel report={full} row={{ ...row, subtopicId: 'zy' }} deps={deps(async () => { throw new Error('limit'); })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate AI brief' }));
    await waitFor(() => expect(screen.getByText(/limit/)).toBeTruthy());
  });
});
