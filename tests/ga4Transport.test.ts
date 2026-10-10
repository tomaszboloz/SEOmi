import { describe, expect, it, vi } from 'vitest';
import { connectGoogleAnalytics, fetchGoogleAnalyticsPerformance, listGoogleAnalyticsProperties } from '@/services/ga4/transport';

const property = { name: 'properties/123', display_name: null, stream_urls: ['https://site.test/'] };
const discovery = { status: 'complete', property, account_pages: 1, stream_pages: 1, candidates_checked: 1, may_be_truncated: false };
const snapshot = { status: 'missing', start_date: '2026-09-01', end_date: '2026-09-30', discovery, report: null };
const input = { projectId: 'project-1', clientId: 'client-1', siteUrl: 'https://site.test/' };

describe('GA4 transport contract', () => {
  it('sends the exact native arguments, including an optional secret only when present', async () => {
    const invoke = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce(discovery).mockResolvedValueOnce(snapshot);
    await connectGoogleAnalytics({ projectId: input.projectId, clientId: input.clientId, clientSecret: '  ' }, invoke);
    await connectGoogleAnalytics({ projectId: input.projectId, clientId: input.clientId, clientSecret: ' secret ' }, invoke);
    await listGoogleAnalyticsProperties(input, invoke);
    await fetchGoogleAnalyticsPerformance({ ...input, startDate: '2026-09-01', endDate: '2026-09-30' }, invoke);
    expect(invoke.mock.calls.map(([command, args]) => [command, args])).toEqual([
      ['connect_google_analytics', { projectId: 'project-1', clientId: 'client-1' }],
      ['connect_google_analytics', { projectId: 'project-1', clientId: 'client-1', clientSecret: 'secret' }],
      ['list_google_analytics_properties', input],
      ['google_analytics_performance', { ...input, startDate: '2026-09-01', endDate: '2026-09-30' }],
    ]);
  });

  it('rejects missing credentials and site scope before invoking native IPC', async () => {
    const invoke = vi.fn();
    await expect(connectGoogleAnalytics({ projectId: ' ', clientId: 'client' }, invoke)).rejects.toThrow(/project/);
    await expect(connectGoogleAnalytics({ projectId: 'project', clientId: ' ' }, invoke)).rejects.toThrow(/client ID/);
    await expect(listGoogleAnalyticsProperties({ ...input, siteUrl: ' ' }, invoke)).rejects.toThrow(/site URL/);
    await expect(fetchGoogleAnalyticsPerformance({ ...input, siteUrl: ' ' , startDate: '2026-09-01', endDate: '2026-09-30' }, invoke)).rejects.toThrow(/site URL/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('rejects an invalid report range before IPC and preserves provider failures', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('Analytics unavailable'));
    await expect(fetchGoogleAnalyticsPerformance({ ...input, startDate: '2026-10-01', endDate: '2026-09-30' }, invoke)).rejects.toThrow(/invalid/);
    expect(invoke).not.toHaveBeenCalled();
    await expect(connectGoogleAnalytics({ projectId: 'project', clientId: 'client' }, invoke)).rejects.toThrow('Analytics unavailable');
    await expect(listGoogleAnalyticsProperties(input, invoke)).rejects.toThrow('Analytics unavailable');
    await expect(fetchGoogleAnalyticsPerformance({ ...input, startDate: '2026-09-01', endDate: '2026-09-30' }, invoke)).rejects.toThrow('Analytics unavailable');
  });

  it('surfaces malformed discovery and snapshot payloads instead of filling values', async () => {
    const invoke = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({ ...snapshot, report: {} });
    await expect(listGoogleAnalyticsProperties(input, invoke)).rejects.toThrow(/discovery/);
    await expect(fetchGoogleAnalyticsPerformance({ ...input, startDate: '2026-09-01', endDate: '2026-09-30' }, invoke)).rejects.toThrow(/snapshot|report/);
  });
});
