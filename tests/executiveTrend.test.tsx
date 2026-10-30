import { render, renderHook, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrawlExecutiveTab } from '@/components/Domain/crawlResults/executive/CrawlExecutiveTab';
import { ExecutiveHssHero } from '@/components/Domain/crawlResults/executive/ExecutiveHssHero';
import { ExecutiveModuleCards } from '@/components/Domain/crawlResults/executive/ExecutiveModuleCards';
import { useHssTrend } from '@/components/Domain/crawlResults/executive/useHssTrend';
import i18n from '@/i18n';
import { computeHss, hssSnapshot, hssTrend, loadHssHistory, type HssModuleInput } from '@/services/hss';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));

const inputs = (sfs: number, tas: number | null): HssModuleInput[] => [{ module: 'sfs', value: sfs }, { module: 'tas', value: tas }, { module: 'eetv', value: 70 }, { module: 'aior', value: 90 }];
const before = computeHss(inputs(70, 60), 'r1');

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); });

describe('Executive trend (#73 per-card trend, #72 history)', () => {
  it('shows the HSS change in words and per measured card; unmeasured modules have no trend line', () => {
    const now = computeHss(inputs(80, 50), 'r2');
    const trend = hssTrend(now, [hssSnapshot('p1', before, '2026-10-01T00:00:00Z')], '2026-10-02T00:00:00Z');
    render(<><ExecutiveHssHero hss={now} trend={trend} /><ExecutiveModuleCards hss={now} trend={trend} onOpen={vi.fn()} /></>);
    expect(screen.getByTestId('executive-hss-trend').textContent).toMatch(/^Down -0\.8 vs previous run/);
    expect(within(screen.getByText('Site Focus (SFS)').closest('li')!).getByText(/Up \+10 vs previous run/)).toBeTruthy();
    expect(within(screen.getByText('Topical Authority (TAS)').closest('li')!).getByText(/Down -10 vs previous run/)).toBeTruthy();
    expect(within(screen.getByText('Entity trust (EETV)').closest('li')!).getByText(/No change vs previous run/)).toBeTruthy();
    expect(within(screen.getByText('Information Gain (IGOS)').closest('li')!).queryByText(/previous run/)).toBeNull();
  });

  it('says when there is no earlier run or the value is not comparable', () => {
    const now = computeHss(inputs(80, null), 'r2');
    const trend = hssTrend(now, [hssSnapshot('p1', before, '2026-10-01T00:00:00Z')], '2026-10-02T00:00:00Z');
    const { rerender } = render(<ExecutiveHssHero hss={now} trend={trend} />);
    expect(screen.getByTestId('executive-hss-trend').textContent).toMatch(/^Not comparable/);
    rerender(<ExecutiveHssHero hss={now} />);
    expect(screen.getByTestId('executive-hss-trend').textContent).toMatch(/^No earlier saved run/);
  });

  it('records the HSS of a saved run once, and only reads history for an unsaved run or missing date', () => {
    renderHook(() => useHssTrend('p1', before, '2026-10-01T00:00:00Z'));
    const { result, rerender } = renderHook(({ hss }) => useHssTrend('p1', hss, '2026-10-02T00:00:00Z'), { initialProps: { hss: computeHss(inputs(80, 60), 'r2') } });
    expect(result.current?.previous.runId).toBe('r1');
    rerender({ hss: computeHss(inputs(80, 60), 'r2') });
    expect(loadHssHistory('p1').map((row) => row.runId)).toEqual(['r2', 'r1']);
    const draft = computeHss(inputs(90, 60), 'unsaved');
    const unsaved = renderHook(() => useHssTrend('p1', draft, '2026-10-03T00:00:00Z'));
    expect(unsaved.result.current?.previous.runId).toBe('r2');
    expect(renderHook(() => useHssTrend('p1', before, null)).result.current).toBeNull();
    expect(loadHssHistory('p1')).toHaveLength(2);
  });

  it('a crawl without measurable modules shows no trend and stores nothing', () => {
    const result = createCrawlResultFixture();
    render(<CrawlExecutiveTab pages={result.pages} startUrl={result.start_url} run={createCrawlRunFixture({ result })} projectId="p1" onOpenTab={vi.fn()} />);
    expect(screen.getByTestId('executive-hss-trend').textContent).toMatch(/^No earlier saved run/);
    expect(loadHssHistory('p1')).toEqual([]);
  });
});
