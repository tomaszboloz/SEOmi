import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const desktop = vi.hoisted(() => ({ value: true }));
vi.mock('@/services/tauri', () => ({ isTauriEnvironment: () => desktop.value, invokeTauriCommand: vi.fn() }));
vi.mock('@/services/desktopNotifications', () => ({ notifyCrawlCompleted: vi.fn() }));
vi.mock('@/components/Domain/siteAudit/siteAuditHelpers', () => ({ focusCrawlStartForm: vi.fn() }));

import i18n from '@/i18n';
import { notifyCrawlCompleted } from '@/services/desktopNotifications';
import { useToolsStore } from '@/stores/toolsStore';
import { useCrawlExecution } from '@/components/Domain/siteAudit/session/useCrawlExecution';
import type { CrawlReportTemplate } from '@/services/reportTemplates';

const services = { downloadPdf: vi.fn(), compare: vi.fn(() => ({ added: [] })) } as never;
const template = { id: 't' } as unknown as CrawlReportTemplate;
const mount = (project: string | null = 'p1', validate = vi.fn().mockResolvedValue({ valid: true })) =>
  ({ validate, ...renderHook(({ id }) => useCrawlExecution(id, services, ' https://a.test/ ', 25, validate, template), { initialProps: { id: project } }) });
const run = (id: string, environment: string, startUrl: string) => ({ id, environment, startUrl, result: { health_score: 80 } });
const seedTools = (patch: Record<string, unknown> = {}) => useToolsStore.setState({ crawlResult: null, crawlRuns: [], isCrawling: false, selectedCrawlRunId: null, crawlError: null, ...patch } as never);

beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); desktop.value = true; await i18n.changeLanguage('en'); seedTools(); });
afterEach(() => vi.clearAllMocks());

describe('starting a crawl', () => {
  it('needs the desktop app, a URL and valid filters; then stores inputs and starts', async () => {
    const start = vi.fn().mockResolvedValue(null);
    seedTools({ startSiteCrawl: start });
    const event = { preventDefault: vi.fn() } as never;
    const blocked = mount('p1', vi.fn().mockResolvedValue({ valid: false }));
    await act(async () => { await blocked.result.current.handleStartCrawl(event); });
    expect(start).not.toHaveBeenCalled();
    desktop.value = false;
    const browser = mount();
    await act(async () => { await browser.result.current.handleStartCrawl(event); });
    expect(browser.validate).not.toHaveBeenCalled();
    desktop.value = true;
    const ok = mount();
    await act(async () => { await ok.result.current.handleStartCrawl(event); });
    expect(start).toHaveBeenCalledWith('https://a.test/', 25);
    expect(useToolsStore.getState().crawlUrl).toBe('https://a.test/');
  });
});

describe('environment comparison', () => {
  const urls = async (view: ReturnType<typeof mount>) => {
    // One act per field, as in the UI: each change renders before the next.
    await act(async () => { view.result.current.updateEnvironmentUrl('staging', 'https://s.test/'); });
    await act(async () => { view.result.current.updateEnvironmentUrl('production', 'https://p.test/'); });
  };

  it('persists the URLs per project and restores them', async () => {
    const view = mount();
    await urls(view);
    expect(view.result.current.environmentUrls.production).toBe('https://p.test/');
    const again = mount();
    expect(again.result.current.environmentUrls).toEqual({ staging: 'https://s.test/', production: 'https://p.test/' });
    expect(mount('other').result.current.environmentUrls).toEqual({ staging: '', production: '' });
  });

  it('crawls staging then production, selects the staging run and notifies', async () => {
    const start = vi.fn(async (url: string, _l: number, _c: unknown, environment: string) => {
      const id = environment === 'staging' ? 'run-s' : 'run-p';
      useToolsStore.setState({ crawlRuns: [...useToolsStore.getState().crawlRuns, run(id, environment, url)] } as never);
      return { health_score: environment === 'staging' ? 70 : 90 };
    });
    seedTools({ startSiteCrawl: start });
    const view = mount();
    await urls(view);
    await act(async () => { await view.result.current.runEnvironmentComparison(); });
    expect(start).toHaveBeenNthCalledWith(1, 'https://s.test/', 25, undefined, 'staging', false);
    expect(view.result.current.comparisonRunId).toBe('run-s');
    expect(view.result.current.comparisonByPath).toBe(true);
    expect(view.result.current.environmentComparisonError).toBeNull();
    expect(notifyCrawlCompleted).toHaveBeenCalledWith('p1', { health_score: 90 }, { health_score: 70 }, { runId: 'run-p' });
  });

  it.each([
    ['staging returns nothing', async () => null, 'boom'],
    ['staging run is not saved', async () => ({ health_score: 1 }), i18n.t('siteAudit.stagingRunSaveError')],
  ])('reports a failure when %s', async (_name, result, message) => {
    seedTools({ startSiteCrawl: vi.fn(result as never), crawlError: 'boom' });
    const view = mount();
    await urls(view);
    await act(async () => { await view.result.current.runEnvironmentComparison(); });
    expect(view.result.current.environmentComparisonError).toBe(message);
    expect(view.result.current.isEnvironmentComparisonRunning).toBe(false);
  });

  it('refuses without desktop, missing URLs or a crawl in progress', async () => {
    const start = vi.fn();
    seedTools({ startSiteCrawl: start });
    desktop.value = false;
    const browser = mount();
    await act(async () => { await browser.result.current.runEnvironmentComparison(); });
    expect(browser.result.current.environmentComparisonError).toBe(i18n.t('runtimeErrors.tauri.desktopOnly'));
    desktop.value = true;
    const empty = mount();
    await act(async () => { await empty.result.current.runEnvironmentComparison(); });
    seedTools({ startSiteCrawl: start, isCrawling: true });
    const busy = mount();
    await urls(busy);
    await act(async () => { await busy.result.current.runEnvironmentComparison(); });
    expect(start).not.toHaveBeenCalled();
  });
});
