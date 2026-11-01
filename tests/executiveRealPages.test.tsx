import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrawlExecutiveTab } from '@/components/Domain/crawlResults/executive/CrawlExecutiveTab';
import { useExecutiveData } from '@/components/Domain/crawlResults/executive/useExecutiveData';
import i18n from '@/i18n';
import { writeJsonStorage } from '@/services/storage';
import type { CrawledPageSummary } from '@/types';
import { createCrawlRunFixture } from './fixtures/crawl';
import { offerBlogSite } from './sfsCalibrationScenarios';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));
const aioBoom = vi.hoisted(() => ({ fail: false }));
vi.mock('@/services/aioReadiness', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/services/aioReadiness')>();
  return { ...real, buildAioReport: (...args: Parameters<typeof real.buildAioReport>) => { if (aioBoom.fail) throw new Error('boom'); return real.buildAioReport(...args); } };
});

const pages = offerBlogSite() as unknown as CrawledPageSummary[];
const start = pages[0].url;
const run = createCrawlRunFixture({ id: 'run-1', completedAt: '2026-10-01T00:00:00Z' });

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); aioBoom.fail = false; });

describe('useExecutiveData on real pages', () => {
  it('builds every module and an action feed, with and without project, run and history', () => {
    const full = renderHook(() => useExecutiveData(pages, start, run, 'p1')).result.current;
    expect(full.runId).toBe('run-1');
    expect(full.sfs).not.toBeNull();
    expect(full.hss.measuredCount).toBeGreaterThan(0);
    const bare = renderHook(() => useExecutiveData(pages, start, null, null)).result.current;
    expect(bare.runId).toBe('unsaved');
    const none = renderHook(() => useExecutiveData([], start, undefined, undefined)).result.current;
    expect(none.sfs).toBeNull();
    expect(none.actions).toEqual([]);
  });

  it('uses per-phrase history for IGOS and SIJA', () => {
    const igos = (value: number) => ({ runAt: '2026-01-01', targetUrl: 'u', provider: 'l', model: 'm', igos: value, status: 'ready', availableDocs: 3, requestedDocs: 3, docUrls: [] });
    writeJsonStorage('seomi_project_p1_igos_history_v1', { a: [igos(40)], b: [igos(60)], c: [igos(80)] });
    const { hss } = renderHook(() => useExecutiveData(pages, start, run, 'p1')).result.current;
    expect(hss.components.find((item) => item.module === 'igos')?.value).toBe(60);
  });

  it('turns a failing module into unavailable instead of throwing', () => {
    aioBoom.fail = true;
    const { hss } = renderHook(() => useExecutiveData(pages, start, run, 'p1')).result.current;
    expect(hss.components.find((item) => item.module === 'aior')?.status).toBe('unavailable');
  });

  it('recomputes when the revision changes', () => {
    const { result, rerender } = renderHook(({ revision }) => useExecutiveData(pages, start, run, 'p1', revision), { initialProps: { revision: 0 } });
    const first = result.current;
    rerender({ revision: 1 });
    expect(result.current).not.toBe(first);
    expect(result.current.hss.value).toBe(first.hss.value);
  });
});

describe('CrawlExecutiveTab on real pages', () => {
  it('shows actions with cards, refreshes and exports', async () => {
    const copy = vi.fn(async () => true);
    vi.doMock('@/services/clipboard', () => ({ copyText: copy }));
    render(<CrawlExecutiveTab pages={pages} startUrl={start} run={run} projectId="p1" onOpenTab={vi.fn()} />);
    expect(screen.getByRole('navigation', { name: 'Related views' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate from saved data' }));
    expect(screen.getAllByText(i18n.t('executive.card.title')).length).toBeGreaterThan(0);
  });

  it('renders without a project id or a saved run', () => {
    render(<CrawlExecutiveTab pages={pages} startUrl={start} onOpenTab={vi.fn()} />);
    expect(screen.getByText('Run: not saved yet')).toBeTruthy();
  });
});
