import { describe, expect, it } from 'vitest';
import type { FocusPage, SfsSnapshot } from '@/services/siteFocus';
import { buildHistorySeries, buildWeeklyReport, detectChangedPages, weeklyNotification } from '@/services/siteFocusMonitoring';
import { createCrawlPageFixture } from './fixtures/crawl';

const snap = (runId: string, at: string, score: number, pages: SfsSnapshot['pages'] = { 'https://a.test/': { trs: 80, weight: 1, type: 'article' } }): SfsSnapshot => ({
  runId, at, score, pageCount: Object.keys(pages).length, coreTopic: { label: 't', clusterId: 'c1' }, clusterLabels: ['t'], pages,
});

describe('history series', () => {
  it('orders points, computes deltas and flattens annotation markers', () => {
    const snaps = [snap('b', '2026-10-08T00:00:00Z', 70), snap('a', '2026-10-01T00:00:00Z', 60.04), snap('c', 'bad-date', 10)];
    const series = buildHistorySeries(snaps, { b: [{ code: 'removed-offtopic', params: { count: 2 }, delta: 4 }] });
    expect(series.points.map((point) => point.runId)).toEqual(['c', 'a', 'b']);
    expect(series.points.map((point) => point.delta)).toEqual([null, 50, 10]);
    expect(series.markers).toEqual([{ runId: 'b', at: '2026-10-08T00:00:00Z', score: 70, code: 'removed-offtopic', params: { count: 2 }, delta: 4 }]);
    expect(buildHistorySeries([snap('x', '2026-10-01T00:00:00Z', 1)])).toMatchObject({ markers: [] });
  });
});

describe('changed page detection', () => {
  it('finds new and hash-changed pages and unseen sitemap URLs', () => {
    const page = (path: string, hash?: string) => createCrawlPageFixture({ url: `https://x.test${path}`, content_hash: hash }) as FocusPage;
    const base = [page('/a', 'h1'), page('/b', 'h1'), page('/c'), page('/d', 'h1')];
    const latest = [page('/a', 'h1'), page('/b', 'h2'), page('/c', 'h3'), page('/d'), page('/e', 'h1')];
    const result = detectChangedPages(base, latest, ['https://x.test/e', 'https://x.test/z']);
    expect(result.added.map((p) => p.url)).toEqual(['https://x.test/e']);
    expect(result.changed.map((p) => p.url)).toEqual(['https://x.test/b']);
    expect(result.unseenSitemapUrls).toEqual(['https://x.test/z']);
    expect(detectChangedPages(base, base).unseenSitemapUrls).toEqual([]);
  });
});

describe('weekly report', () => {
  const rec = (code: string, ratio: number, deltaScore: number) => ({ code, params: {}, deltaScore, effort: { minHours: 1, maxHours: 2, estimate: true as const }, ratio, urls: [] });
  const report = { score: 61.26, recommendations: [rec('b', 2, 3), rec('a', 2, 3), rec('c', 5, 1), rec('d', 2, 4), rec('zero', 9, 0), rec('e', 1, 1), rec('a2', 2, 3)] };
  it('ranks by gain per effort, ties by gain then code, and keeps three', () => {
    const weekly = buildWeeklyReport(report as never, 58);
    expect(weekly.tasks.map((task) => task.code)).toEqual(['c', 'd', 'a']);
    expect(weekly.delta).toBe(3.3);
    expect(buildWeeklyReport(report as never).delta).toBeNull();
  });
  it('formats the notification with localized text', () => {
    expect(weeklyNotification(buildWeeklyReport(report as never, 70))).toMatchObject({ title: expect.stringContaining('Weekly'), body: expect.stringContaining('-8.7') });
    expect(weeklyNotification(buildWeeklyReport(report as never, 50)).body).toContain('+11.3');
    expect(weeklyNotification(buildWeeklyReport({ score: 40, recommendations: [] }))).toMatchObject({ body: expect.stringContaining('no urgent tasks') });
    expect(weeklyNotification({ score: 40, delta: 0, tasks: [] }).body).not.toContain('+0');
  });
});
