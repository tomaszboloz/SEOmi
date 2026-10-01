import type { CruxReport, PageSpeedReport } from '@/services/pagespeed';
import type { PageSpeedSnapshot } from '@/services/pagespeedHistory';
export const pageSpeedReport = (): PageSpeedReport => ({
  source: 'Fixture PSI', requestedUrl: 'https://site.test/', finalUrl: 'https://site.test/', strategy: 'mobile',
  fetchedAt: '2026-10-01T00:00:00Z', lighthouseVersion: null,
  categories: { performance: 0, accessibility: null, bestPractices: 100, seo: 50 },
  metrics: {}, opportunities: [], fieldExperience: null, originExperience: null,
});
export const cruxReport = (): CruxReport => ({
  source: 'Fixture CrUX', target: 'https://site.test/', scope: 'url', formFactor: 'PHONE',
  fetchedAt: '2026-10-01T00:00:00Z', response: {},
});
export const historySnapshot = (patch: Partial<PageSpeedSnapshot> = {}): PageSpeedSnapshot => ({
  id: 'observed', capturedAt: '2026-10-01T00:00:00Z', url: 'https://site.test/', strategy: 'mobile',
  scope: 'url', formFactor: 'PHONE', pageSpeed: pageSpeedReport(), crux: cruxReport(), ...patch,
});
