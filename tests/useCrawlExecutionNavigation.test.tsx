import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/tauri', () => ({ isTauriEnvironment: () => true, invokeTauriCommand: vi.fn() }));
vi.mock('@/services/desktopNotifications', () => ({ notifyCrawlCompleted: vi.fn() }));
vi.mock('@/components/Domain/siteAudit/siteAuditHelpers', () => ({ focusCrawlStartForm: vi.fn() }));

import i18n from '@/i18n';
import { focusCrawlStartForm } from '@/components/Domain/siteAudit/siteAuditHelpers';
import { useToolsStore } from '@/stores/toolsStore';
import { useCrawlExecution } from '@/components/Domain/siteAudit/session/useCrawlExecution';

const downloadPdf = vi.fn();
const compare = vi.fn(() => ({ added: [] }));
const mount = (project: string | null = 'p1') => renderHook(({ id }) => useCrawlExecution(id, { downloadPdf, compare } as never, 'https://a.test/', 25, vi.fn(), { id: 't' } as never), { initialProps: { id: project } });
const result = (score: number) => ({ health_score: score });
const seed = (patch: Record<string, unknown> = {}) => useToolsStore.setState({ crawlResult: null, crawlRuns: [], isCrawling: false, selectedCrawlRunId: null, ...patch } as never);

beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); await i18n.changeLanguage('en'); seed(); });
afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = ''; });

describe('crawl map requests', () => {
  it('opens the map when a crawl result exists and asks for a crawl otherwise', () => {
    seed({ crawlResult: result(80) });
    const view = mount();
    act(() => { window.dispatchEvent(new Event('seomi:open-crawl-map')); });
    expect(view.result.current.mapNavigationRequest).toBe(1);
    expect(view.result.current.mapRequiresCrawl).toBe(false);
    seed();
    act(() => { window.dispatchEvent(new Event('seomi:open-crawl-map')); });
    expect(view.result.current.mapRequiresCrawl).toBe(true);
    expect(focusCrawlStartForm).toHaveBeenCalledOnce();
  });

  it('honours a stored one-shot map request exactly once', () => {
    sessionStorage.setItem('seomi_open_crawl_map_v1', '1');
    const view = mount();
    expect(view.result.current.mapRequiresCrawl).toBe(true);
    expect(sessionStorage.getItem('seomi_open_crawl_map_v1')).toBeNull();
    view.unmount();
    expect(mount().result.current.mapRequiresCrawl).toBe(false);
  });

  it('stops listening after unmount', () => {
    seed({ crawlResult: result(80) });
    const view = mount();
    view.unmount();
    act(() => { window.dispatchEvent(new Event('seomi:open-crawl-map')); });
    expect(view.result.current.mapNavigationRequest).toBe(0);
  });
});

describe('PDF export', () => {
  it('exports the selected run and reports a failure', async () => {
    const selected = { id: 'r1', result: result(80) };
    seed({ crawlRuns: [selected], selectedCrawlRunId: 'r1' });
    const view = mount();
    await act(async () => { await view.result.current.exportCrawlPdf(); });
    expect(downloadPdf).toHaveBeenCalledWith(selected, { id: 't' });
    downloadPdf.mockRejectedValueOnce(new Error('disk full'));
    await act(async () => { await view.result.current.exportCrawlPdf(); });
    expect(view.result.current.crawlPdfError).toBe('disk full');
    downloadPdf.mockRejectedValueOnce('x');
    await act(async () => { await view.result.current.exportCrawlPdf(); });
    expect(view.result.current.crawlPdfError).toBe(i18n.t('siteAudit.pdfError'));
  });

  it('does nothing without a selected run', async () => {
    const view = mount();
    await act(async () => { await view.result.current.exportCrawlPdf(); });
    expect(downloadPdf).not.toHaveBeenCalled();
  });
});

describe('run comparison and project scope', () => {
  it('compares the current result with another saved run, by path when enabled', () => {
    const current = result(80);
    seed({ crawlResult: current, crawlRuns: [{ id: 'base', result: result(60) }, { id: 'same', result: current }] });
    const view = mount();
    expect(view.result.current.comparison).toBeNull();
    act(() => { view.result.current.setComparisonRunId('same'); });
    expect(view.result.current.comparison).toBeNull();
    act(() => { view.result.current.updateComparisonByPath(true); view.result.current.setComparisonRunId('base'); });
    expect(compare).toHaveBeenCalledWith(current, { health_score: 60 }, { matchByPath: true });
    expect(localStorage.getItem('seomi_project_p1_crawl_compare_path_v1')).toBe('true');
  });

  it('resets per-project state on a project switch and scrolls to results', () => {
    const view = mount('p1');
    act(() => { view.result.current.setComparisonRunId('x'); view.result.current.updateComparisonByPath(true); });
    view.rerender({ id: 'p2' });
    expect(view.result.current.comparisonRunId).toBe('');
    expect(view.result.current.comparisonByPath).toBe(false);
    view.rerender({ id: null });
    expect(view.result.current.environmentUrls).toEqual({ staging: '', production: '' });
    const target = Object.assign(document.createElement('div'), { id: 'crawl-results', tabIndex: -1 });
    target.scrollIntoView = vi.fn(); target.focus = vi.fn();
    document.body.append(target);
    act(() => { view.result.current.scrollToResults('auto'); });
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
