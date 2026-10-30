import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrawlExecutiveTab } from '@/components/Domain/crawlResults/executive/CrawlExecutiveTab';
import { ExecutiveActionFeed } from '@/components/Domain/crawlResults/executive/ExecutiveActionFeed';
import { ExecutiveHssHero } from '@/components/Domain/crawlResults/executive/ExecutiveHssHero';
import { ExecutiveModuleCards } from '@/components/Domain/crawlResults/executive/ExecutiveModuleCards';
import { ExecutiveWhatIf } from '@/components/Domain/crawlResults/executive/ExecutiveWhatIf';
import i18n from '@/i18n';
import type { ExecutiveAction } from '@/services/actionFeed';
import { computeHss } from '@/services/hss';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));
const copy = vi.hoisted(() => vi.fn(async () => true));
vi.mock('@/services/clipboard', () => ({ copyText: copy }));

const partial = computeHss([{ module: 'sfs', value: 80 }, { module: 'tas', value: 60 }, { module: 'eetv', value: 70 }, { module: 'aior', value: 90 }], 'r');
const action = (patch: Partial<ExecutiveAction>): ExecutiveAction => ({
  id: 'a', type: 'tas:merge-cannibalized', source: 'tas', urls: ['https://a.pl/x'], evidence: [{ source: 'tas', code: 'merge-cannibalized', params: {} }],
  effort: { minHours: 2, maxHours: 4, estimate: true }, moduleDelta: { module: 'tas', value: 5 }, hssDelta: 2.1, conflicts: [], dependsOn: [], blocked: false, drillTab: 'authority', ...patch,
});

beforeEach(async () => { await i18n.changeLanguage('en'); copy.mockClear(); });

describe('Executive dashboard (#73)', () => {
  it('hero shows partial HSS with coverage and withholds an insufficient score', () => {
    const { rerender } = render(<ExecutiveHssHero hss={partial} />);
    expect(screen.getByText('70.8')).toBeTruthy();
    expect(screen.getByText('Partial')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('60');
    rerender(<ExecutiveHssHero hss={computeHss([{ module: 'sfs', value: 80 }], 'r')} />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText(/Renormalised over measured modules: 80/)).toBeTruthy();
  });

  it('module cards never show 0 for a missing module and drill down to existing tabs', () => {
    const open = vi.fn();
    render(<ExecutiveModuleCards hss={partial} onOpen={open} />);
    const igos = screen.getByText('Information Gain (IGOS)').closest('li')!;
    expect(within(igos).getByText('—')).toBeTruthy();
    expect(within(igos).queryByRole('button')).toBeNull();
    fireEvent.click(within(screen.getByText('Topical Authority (TAS)').closest('li')!).getByRole('button'));
    expect(open).toHaveBeenCalledWith('authority');
  });

  it('action feed shows delta, unavailable delta, conflicts and drill-down', () => {
    const open = vi.fn();
    render(<ExecutiveActionFeed onOpen={open} actions={[
      action({}),
      action({ id: 'b', type: 'internal-link', source: 'links', urls: ['https://a.pl/p', 'https://a.pl/hub'], effort: null, moduleDelta: null, hssDelta: null, drillTab: 'visualisations', blocked: true, conflicts: [{ kind: 'needs-data', urls: ['x'] }], dependsOn: ['a'] }),
    ]} />);
    expect(screen.getByText('HSS Δ +2.1')).toBeTruthy();
    expect(screen.getByText('HSS Δ unavailable (no declared model)')).toBeTruthy();
    expect(screen.getByText('Add an internal link: https://a.pl/p → https://a.pl/hub')).toBeTruthy();
    expect(screen.getByText(/Telemetry missing or stale/)).toBeTruthy();
    expect(screen.getByText('Do after 1 other action(s).')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Map & clusters' }));
    expect(open).toHaveBeenCalledWith('visualisations');
  });

  it('What-If recomputes on a copy and resets without touching the baseline', () => {
    const before = JSON.stringify(partial);
    render(<ExecutiveWhatIf hss={partial} />);
    fireEvent.change(screen.getByLabelText('Site Focus (SFS)'), { target: { value: '90' } });
    expect(screen.getByText('Scenario HSS 74.2 (+3.4)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Site Focus (SFS)'), { target: { value: '500' } });
    expect(screen.getByText('Scenario HSS 70.8 (0)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(JSON.stringify(partial)).toBe(before);
    const { container } = render(<ExecutiveWhatIf hss={computeHss([], 'r')} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders from a real crawl and exports reproducible JSON', async () => {
    const result = createCrawlResultFixture();
    const run = createCrawlRunFixture({ result });
    render(<CrawlExecutiveTab pages={result.pages} startUrl={result.start_url} run={run} projectId="p1" onOpenTab={vi.fn()} />);
    expect(screen.getByText('Executive dashboard')).toBeTruthy();
    expect(screen.getAllByText(/Per-page module/)).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Copy HSS + actions (JSON)' }));
    expect(await screen.findByText('Copied')).toBeTruthy();
    const payload = JSON.parse((copy.mock.calls[0] as unknown as [string])[0]);
    expect(payload.hss.schema).toBe('seomi.hss/1');
    expect(Array.isArray(payload.actions)).toBe(true);
  });
});
