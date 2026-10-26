import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gscSnapshotStorageKey } from '@/services/gscTracker/limits';
import { snapshotGscPerformance } from '@/services/gscTracker/snapshot';
import { writeJsonStorage } from '@/services/storage';
import { clearSnapshots, ensureUrlTelemetry, forgetGa4Reports, getSnapshot } from '@/services/urlTelemetry';
import { backlinkProfileKey, backlinkProfileHistoryKey, readBacklinkTelemetry } from '@/services/urlTelemetry/backlinkPersistence';
import { TELEMETRY_NOW, TELEMETRY_URLS, telemetryBacklinks, telemetryBacklinkHistory, telemetryGsc } from './fixtures/telemetrySources';

vi.mock('@/i18n', () => { throw new Error('Telemetry services must not initialize UI translations'); });

const saveGsc = (projectId: string) => writeJsonStorage(
  gscSnapshotStorageKey(projectId), [snapshotGscPerformance(telemetryGsc(), TELEMETRY_NOW.toISOString())],
);

beforeEach(() => { localStorage.clear(); clearSnapshots(); forgetGa4Reports(); });
afterEach(() => { clearSnapshots(); forgetGa4Reports(); });

describe('persisted backlink telemetry', () => {
  it.each([null, { domain: 'a.test' }, 'broken'])('keeps absent or malformed profiles unavailable: %j', (profile) => {
    writeJsonStorage(backlinkProfileKey('p'), profile);
    expect(readBacklinkTelemetry('p')).toEqual({ backlinks: null });
    saveGsc('p');
    const snapshot = ensureUrlTelemetry('p', TELEMETRY_URLS, TELEMETRY_NOW)!;
    expect(snapshot.sources.backlinks).toEqual({ state: 'unavailable' });
    expect(snapshot.urls.every((row) => row.backlinks.value === null)).toBe(true);
  });

  it('reads the stored sample, provider and latest matching valid retrieval time without UI imports', () => {
    const profile = telemetryBacklinks();
    writeJsonStorage(backlinkProfileKey('p'), profile);
    writeJsonStorage(backlinkProfileHistoryKey('p'), [
      telemetryBacklinkHistory({ retrieved_at: '2026-10-20T08:00:00Z' }), telemetryBacklinkHistory(),
      telemetryBacklinkHistory({ domain: 'other.test', retrieved_at: '2026-10-25T08:00:00Z' }),
      telemetryBacklinkHistory({ retrieved_at: 'invalid' }), { junk: true },
    ]);
    expect(readBacklinkTelemetry('p')).toEqual({
      backlinks: profile, backlinkProvider: 'DataForSEO', backlinkRetrievedAt: TELEMETRY_NOW.toISOString(),
    });
    saveGsc('p');
    const snapshot = ensureUrlTelemetry('p', TELEMETRY_URLS, TELEMETRY_NOW)!;
    expect(snapshot.sources.backlinks).toEqual({
      state: 'sampled', provider: 'DataForSEO', retrievedAt: TELEMETRY_NOW.toISOString(), coveragePct: 20,
    });
    expect(snapshot.urls.find((row) => row.url.endsWith('/low'))?.backlinks).toEqual({ state: 'sampled', value: { referringDomains: 1 } });
    expect(snapshot.urls.find((row) => row.url === TELEMETRY_URLS[0])?.backlinks).toEqual({ state: 'sampled', value: null });
    expect(ensureUrlTelemetry('p', TELEMETRY_URLS, TELEMETRY_NOW)).toBe(snapshot);
  });

  it.each([null, [], [telemetryBacklinkHistory({ domain: 'other.test' })]])('does not invent a retrieval time for missing matching history: %j', (history) => {
    writeJsonStorage(backlinkProfileKey('p'), telemetryBacklinks());
    writeJsonStorage(backlinkProfileHistoryKey('p'), history);
    expect(readBacklinkTelemetry('p')).toMatchObject({ backlinkProvider: 'DataForSEO', backlinkRetrievedAt: undefined });
  });

  it.each([0, 2])('never zero-fills unlisted URLs even with a complete or empty sample (%i)', (total) => {
    writeJsonStorage(backlinkProfileKey('p'), telemetryBacklinks({ total_backlinks: total, backlinks: total ? telemetryBacklinks().backlinks : [] }));
    saveGsc('p');
    const snapshot = ensureUrlTelemetry('p', TELEMETRY_URLS, TELEMETRY_NOW)!;
    expect(snapshot.sources.backlinks.state).toBe('measured');
    expect(snapshot.urls.find((row) => row.url === TELEMETRY_URLS[0])?.backlinks).toEqual({ state: 'unavailable', value: null });
    expect(snapshot.sources.backlinks.coveragePct).toBe(total ? 100 : null);
  });

  it('keeps projects isolated and still requires a saved GSC snapshot', () => {
    writeJsonStorage(backlinkProfileKey('p'), telemetryBacklinks());
    expect(ensureUrlTelemetry('p', TELEMETRY_URLS, TELEMETRY_NOW)).toBeNull();
    saveGsc('other');
    expect(ensureUrlTelemetry('other', TELEMETRY_URLS, TELEMETRY_NOW)?.sources.backlinks.state).toBe('unavailable');
  });

  it('does not cache telemetry when the supplied root has no usable URL scope', () => {
    saveGsc('p');
    writeJsonStorage(backlinkProfileKey('p'), telemetryBacklinks());
    expect(ensureUrlTelemetry('p', ['not-a-url'], TELEMETRY_NOW)).toBeNull();
    expect(getSnapshot('p', TELEMETRY_NOW)).toBeNull();
  });
});
