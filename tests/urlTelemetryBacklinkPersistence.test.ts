import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveGscSnapshot } from '@/services/gscTracker/persistence';
import { clearSnapshots, ensureUrlTelemetry, forgetGa4Reports, getSnapshot } from '@/services/urlTelemetry';
import { saveProjectResearch, saveBacklinkProfileSnapshot } from '@/stores/tools/researchPersistence';
import { backlinkProfileKey, domainOverviewKey } from '@/stores/tools/storageKeys';
import { TELEMETRY_NOW, TELEMETRY_URLS, telemetryBacklinks, telemetryGsc } from './fixtures/telemetrySources';

beforeEach(() => {
  localStorage.clear(); clearSnapshots(); forgetGa4Reports();
  vi.useFakeTimers(); vi.setSystemTime(TELEMETRY_NOW);
  saveGscSnapshot('p', telemetryGsc()); saveGscSnapshot('other', telemetryGsc());
});
afterEach(() => { clearSnapshots(); forgetGa4Reports(); vi.useRealTimers(); });

describe('storing a backlink profile invalidates shared telemetry', () => {
  it('drops only the updated project and rebuilds with the persisted profile and retrieval time', () => {
    const before = ensureUrlTelemetry('p', TELEMETRY_URLS)!;
    const other = ensureUrlTelemetry('other', TELEMETRY_URLS)!;
    const profile = telemetryBacklinks();
    saveProjectResearch(backlinkProfileKey, profile, 'p');
    saveBacklinkProfileSnapshot('p', profile, []);
    expect(getSnapshot('p')).toBeNull();
    expect(getSnapshot('other')).toBe(other);
    const after = ensureUrlTelemetry('p', TELEMETRY_URLS)!;
    expect(after).not.toBe(before);
    expect(after.sources.backlinks).toMatchObject({ provider: 'DataForSEO', retrievedAt: TELEMETRY_NOW.toISOString(), coveragePct: 20 });
  });

  it('also invalidates paginated profile updates, but not unrelated research writes', () => {
    const profile = telemetryBacklinks();
    saveProjectResearch(backlinkProfileKey, profile, 'p');
    const initial = ensureUrlTelemetry('p', TELEMETRY_URLS)!;
    saveProjectResearch(domainOverviewKey, { domain: 'a.test' }, 'p');
    expect(getSnapshot('p')).toBe(initial);
    saveProjectResearch(backlinkProfileKey, { ...profile, backlinks: [...profile.backlinks, { ...profile.backlinks[0], source_url: 'https://another.test/' }] }, 'p');
    expect(getSnapshot('p')).toBeNull();
    const after = ensureUrlTelemetry('p', TELEMETRY_URLS)!;
    expect(after.sources.backlinks.coveragePct).toBe(30);
    expect(after.urls.find((row) => row.url.endsWith('/low'))?.backlinks.value?.referringDomains).toBe(2);
  });
});
