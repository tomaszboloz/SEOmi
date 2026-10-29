import { beforeEach, describe, expect, it } from 'vitest';
import { saveGscSnapshot } from '@/services/gscTracker/persistence';
import { ensureUrlTelemetry, isFullScopeGsc, telemetryGscSource } from '@/services/urlTelemetry/fromGscSnapshots';
import { saveGscLastResult } from '@/stores/tools/gscLastResult';
import { gscData } from './fixtures/gscTracker';

const AT = '2026-10-28T08:00:00.000Z';
const NOW = new Date('2026-10-28T12:00:00Z');

beforeEach(() => localStorage.clear());

describe('telemetry Search Console source', () => {
  it('accepts only web search without device or country filters', () => {
    expect(isFullScopeGsc()).toBe(true);
    expect(isFullScopeGsc({ search_type: 'web' })).toBe(true);
    expect(isFullScopeGsc({ device: 'MOBILE' })).toBe(false);
    expect(isFullScopeGsc({ country: 'pol' })).toBe(false);
    expect(isFullScopeGsc({ country: '  ' })).toBe(true);
    expect(isFullScopeGsc({ search_type: 'image' })).toBe(false);
  });

  it('uses the last fetched report when nothing was saved, but never a filtered one', () => {
    expect(telemetryGscSource('p')).toBeUndefined();
    saveGscLastResult('p', { data: gscData({ filters: { device: 'MOBILE' } }), fetchedAt: AT, filters: { device: 'MOBILE' } });
    expect(telemetryGscSource('p')).toBeUndefined();
    expect(ensureUrlTelemetry('p', ['https://example.com/'], NOW)).toBeNull();
    saveGscLastResult('p', { data: gscData({ total_clicks: 7 }), fetchedAt: AT, filters: {} });
    expect(telemetryGscSource('p')?.total_clicks).toBe(7);
  });

  it('prefers the newer period, then the later capture, and skips filtered snapshots', () => {
    saveGscSnapshot('p', gscData({ end_date: '2026-09-30', total_clicks: 1 }), undefined, '2026-10-01T00:00:00Z');
    saveGscSnapshot('p', gscData({ end_date: '2026-10-27', total_clicks: 2, filters: { country: 'pol' } }), undefined, '2026-10-28T00:00:00Z');
    expect(telemetryGscSource('p')?.total_clicks).toBe(1);
    saveGscLastResult('p', { data: gscData({ end_date: '2026-10-20', total_clicks: 3 }), fetchedAt: AT, filters: {} });
    expect(telemetryGscSource('p')?.total_clicks).toBe(3);
    saveGscSnapshot('p', gscData({ end_date: '2026-10-20', total_clicks: 4 }), undefined, '2026-10-29T00:00:00Z');
    expect(telemetryGscSource('p')?.total_clicks).toBe(4);
  });
});
