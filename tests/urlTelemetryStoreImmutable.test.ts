import { afterEach, describe, expect, it } from 'vitest';
import { clearSnapshots, getSnapshot, putSnapshot, type UrlTelemetrySnapshot } from '@/services/urlTelemetry';

const snapshot = (projectId: string, clicks: number): UrlTelemetrySnapshot => ({
  id: `${projectId}-1`, projectId, origin: 'https://a.test', createdAt: '2026-10-30T00:00:00Z', expiresAt: '2026-10-31T00:00:00Z',
  sources: { gsc: { state: 'measured' }, ga4: { state: 'unavailable' }, backlinks: { state: 'unavailable' } },
  urls: [{ url: 'https://a.test/', gsc: { state: 'measured', value: { clicks, impressions: 10, position: null, observedQueryCount: null, queryCountTruncated: false } },
    ga4: { state: 'unavailable', value: null }, backlinks: { state: 'unavailable', value: null }, revenue: { state: 'unavailable', value: null } }],
});
const now = new Date('2026-10-30T12:00:00Z');

afterEach(clearSnapshots);

describe('shared telemetry snapshot store (#91 GEM-91-07, T05)', () => {
  it('keeps projects A and B apart and freezes the cached snapshot', () => {
    putSnapshot(snapshot('A', 5));
    putSnapshot(snapshot('B', 0));
    const a = getSnapshot('A', now)!;
    expect(a.urls[0].gsc.value?.clicks).toBe(5);
    expect(getSnapshot('B', now)?.urls[0].gsc.value?.clicks).toBe(0);
    expect(Object.isFrozen(a.urls[0].gsc.value)).toBe(true);
    expect(() => { (a.urls[0].gsc.value as { clicks: number }).clicks = 99; }).toThrow(TypeError);
    expect(getSnapshot('A', now)?.urls[0].gsc.value?.clicks).toBe(5);
  });

  it('drops an expired snapshot instead of serving stale telemetry', () => {
    putSnapshot(snapshot('A', 5));
    expect(getSnapshot('A', new Date('2026-11-01T00:00:00Z'))).toBeNull();
    expect(getSnapshot('A', now)).toBeNull();
  });
});
