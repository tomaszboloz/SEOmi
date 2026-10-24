import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { saveGscSnapshot } from '@/services/gscTracker/persistence';
import { ga4Report } from './fixtures/ga4Report';
import { gscData } from './fixtures/gscTracker';

let cache: typeof import('@/services/urlTelemetry/ga4Cache');
let storage: typeof import('@/services/storage');
beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  cache = await import('@/services/urlTelemetry/ga4Cache');
  storage = await import('@/services/storage');
});
afterEach(() => vi.restoreAllMocks());

it('writes the exact project key and restores a report after a module restart', async () => {
  const report = ga4Report({ status: 'partial', host_name: 'example.com', pages: 2, row_count: null });
  cache.rememberGa4Report('p', report);
  expect(localStorage.getItem('seomi_project_p_ga4_last_report_v1')).toBe(JSON.stringify(report));
  expect(cache.recallGa4Report('p')).toBe(report);
  vi.resetModules();
  const restarted = await import('@/services/urlTelemetry/ga4Cache');
  const restored = restarted.recallGa4Report('p');
  expect(restored).toEqual(report);
  expect(restored).not.toBe(report);
  localStorage.setItem(restarted.ga4ReportStorageKey('p'), '{bad');
  expect(restarted.recallGa4Report('p')).toBe(restored);
  expect(restarted.recallGa4Report('q')).toBeNull();
});

it('rebuilds shared URL telemetry with persisted GA4 after restart', async () => {
  saveGscSnapshot('p', gscData(), undefined, '2026-07-29T00:00:00Z');
  cache.rememberGa4Report('p', ga4Report());
  vi.resetModules();
  const { ensureUrlTelemetry } = await import('@/services/urlTelemetry/fromGscSnapshots');
  const telemetry = ensureUrlTelemetry('p', ['https://example.com/'], new Date('2026-07-29T00:00:00Z'));
  expect(telemetry?.sources.ga4).toMatchObject({ state: 'partial-history', property: 'properties/1' });
  expect(telemetry?.urls[0].ga4.value).toEqual({ sessions: 10, engagedSessions: 8, keyEvents: 2 });
});

it('invalidates only the remembered or forgotten project shared snapshot', async () => {
  const store = await import('@/services/urlTelemetry/store');
  const { ensureUrlTelemetry } = await import('@/services/urlTelemetry/fromGscSnapshots');
  const now = new Date('2026-07-29T00:00:00Z');
  for (const project of ['p', 'q']) saveGscSnapshot(project, gscData());
  ensureUrlTelemetry('p', ['https://example.com/'], now);
  const other = ensureUrlTelemetry('q', ['https://example.com/'], now);
  cache.rememberGa4Report('p', ga4Report());
  expect(store.getSnapshot('p', now)).toBeNull();
  ensureUrlTelemetry('p', ['https://example.com/'], now);
  cache.forgetGa4Report('p');
  expect(store.getSnapshot('p', now)).toBeNull();
  expect(store.getSnapshot('q', now)).toBe(other);
  expect(cache.recallGa4Report('p')).toBeNull();
});

it('forgets one project without touching another, including an unremembered stored report', () => {
  cache.rememberGa4Report('q', ga4Report());
  localStorage.setItem(cache.ga4ReportStorageKey('p'), JSON.stringify(ga4Report()));
  cache.forgetGa4Report('p');
  expect(localStorage.getItem(cache.ga4ReportStorageKey('p'))).toBeNull();
  expect(cache.recallGa4Report('q')).toEqual(ga4Report());
  cache.forgetGa4Report('q');
  expect(cache.recallGa4Report('q')).toBeNull();
});

it('forgets all known projects but leaves unseen project storage alone', () => {
  cache.rememberGa4Report('remembered', ga4Report());
  for (const project of ['recalled', 'unseen']) {
    localStorage.setItem(cache.ga4ReportStorageKey(project), JSON.stringify(ga4Report()));
  }
  expect(cache.recallGa4Report('recalled')).not.toBeNull();
  expect(cache.recallGa4Report('later')).toBeNull();
  localStorage.setItem(cache.ga4ReportStorageKey('later'), JSON.stringify(ga4Report()));
  cache.forgetGa4Reports();
  cache.forgetGa4Reports();
  for (const project of ['remembered', 'recalled', 'later']) {
    expect(localStorage.getItem(cache.ga4ReportStorageKey(project))).toBeNull();
    expect(cache.recallGa4Report(project)).toBeNull();
  }
  expect(localStorage.getItem(cache.ga4ReportStorageKey('unseen'))).not.toBeNull();
});

it.each([false, true])('bounds persisted rows without changing the memory report (truncated=%s)', async truncated => {
  const report = ga4Report({ rows: Array.from({ length: 5001 }, () => ga4Report().rows[0]), may_be_truncated: truncated });
  cache.rememberGa4Report('p', report);
  expect(cache.recallGa4Report('p')).toBe(report);
  vi.resetModules();
  const restarted = await import('@/services/urlTelemetry/ga4Cache');
  expect(restarted.recallGa4Report('p')?.rows).toHaveLength(5000);
  expect(restarted.recallGa4Report('p')?.may_be_truncated).toBe(true);
});

it('keeps memory semantics when persistent writes or reads are unavailable', () => {
  vi.spyOn(storage, 'writeJsonStorage').mockReturnValue(false);
  vi.spyOn(storage, 'readJsonStorage').mockReturnValue(null);
  vi.spyOn(storage, 'removeStorage').mockReturnValue(false);
  const report = ga4Report();
  cache.rememberGa4Report('p', report);
  expect(cache.recallGa4Report('p')).toBe(report);
  cache.forgetGa4Reports();
  expect(cache.recallGa4Report('p')).toBeNull();
});
