import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: send }));

import { contentGuardEvents, evaluateFocusAlert, focusAlertEvents, normalizeMonitoringSettings, saveMonitoringSettings, readMonitoringHistory, monitorSiteFocus, validAlert, defaultMonitoringAlertSettings } from '@/services/monitoringAlerts';
import {
  applyIncremental, buildRunReport, readFocusHistory,
  recordFullAnalysis, registerSeenUrls,
} from '@/services/siteFocusMonitoring';
import type { FocusPage, PageFocus, SfsSnapshot } from '@/services/siteFocus';
import { diabetesSite, makePage, DIABETES_TERMS, PHONE_TERMS } from './siteFocusFixtures';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const HOST = 'diabetes.test';
const runOf = (id: string, pages: FocusPage[], patch = {}) => createCrawlRunFixture({ id, startUrl: `https://${HOST}/`, result: createCrawlResultFixture({ pages, pages_crawled: pages.length, sitemap_urls: [] }), ...patch });
const enable = (project: string, patch = {}) => saveMonitoringSettings(project, { ...defaultMonitoringAlertSettings(), enabled: true, frequency: 'run', ...patch });
const snapshot = (score: number): SfsSnapshot => ({ runId: 'r', at: 't', score, pageCount: 1, coreTopic: { label: 'a', clusterId: 'c' }, clusterLabels: [], pages: {} });
const focusPage = (url: string, trs: number, skipped?: string) => ({ url, trs, skipped } as unknown as PageFocus);

beforeEach(() => { localStorage.clear(); send.mockReset(); send.mockResolvedValue(true); });

describe('focus alert evaluation', () => {
  it('normalizes the focus type and threshold', () => {
    expect(defaultMonitoringAlertSettings().thresholds.focus.dropPoints).toBe(5);
    expect(normalizeMonitoringSettings({ thresholds: { focus: { dropPoints: 99999 } }, types: { focus: false } })).toMatchObject({ types: { focus: false }, thresholds: { focus: { dropPoints: 100 } } });
    expect(normalizeMonitoringSettings({ thresholds: { focus: { dropPoints: 'x' } } }).thresholds.focus.dropPoints).toBe(5);
  });

  it('flags SFS drops above the threshold and Content Guard hits', () => {
    expect(focusAlertEvents(undefined, snapshot(50))).toEqual([]);
    expect(focusAlertEvents(snapshot(60), snapshot(55))).toEqual([]);
    const settings = normalizeMonitoringSettings({ thresholds: { focus: { dropPoints: 2 } } });
    expect(focusAlertEvents(snapshot(60), snapshot(55.5), [], settings)).toEqual([{ code: 'sfs-drop', params: { from: 60, to: 55.5, points: 4.5 } }]);
    expect(contentGuardEvents([focusPage('u1', 39), focusPage('u2', 40), focusPage('u3', 10, 'no-content')])).toEqual([{ code: 'content-guard', params: { url: 'u1', trs: 39 } }]);
    expect(focusAlertEvents(snapshot(60), snapshot(50), [focusPage('u1', 5)])).toHaveLength(2);
  });

  it('combines events into one valid alert with localized text', () => {
    expect(evaluateFocusAlert([], 'run')).toBeNull();
    const drop = evaluateFocusAlert([{ code: 'sfs-drop', params: { from: 60, to: 50, points: 10 } }], 'run-1');
    expect(drop).toMatchObject({ type: 'focus', sourceId: 'run-1', evidence: { drop: 10 } });
    expect(drop?.body).toContain('fell by 10 points');
    const urls = ['a', 'b', 'c', 'd'].map((url) => ({ code: 'content-guard' as const, params: { url, trs: 3 } }));
    const both = evaluateFocusAlert([...urls, { code: 'sfs-drop', params: { from: 60, to: 50, points: 10 } }], 'run-2');
    expect(both?.body).toContain('4 new page(s)');
    expect(both?.body).not.toContain(', d');
    expect(validAlert(both)).toBe(true);
    const guardOnly = evaluateFocusAlert(urls.slice(0, 1), 'run-3');
    expect(guardOnly?.evidence).toEqual({ guarded: 1, urls: 'a' });
  });

  it('delivers through the notification path only when enabled', async () => {
    const events = [{ code: 'sfs-drop' as const, params: { from: 60, to: 50, points: 10 } }];
    expect((await monitorSiteFocus('p1', events, 'r1')).delivered).toBe(false);
    enable('p1');
    expect((await monitorSiteFocus('p1', events, 'r1')).delivered).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(readMonitoringHistory('p1')[0].type).toBe('focus');
    expect((await monitorSiteFocus('p1', [], 'r2')).alert).toBeNull();
  });
});

describe('full analysis recording', () => {
  it('saves snapshots once per run, annotates changes and raises a drop alert', async () => {
    enable('p1');
    const good = buildRunReport(runOf('r1', diabetesSite(HOST)), undefined, '2026-10-01T00:00:00Z');
    const first = recordFullAnalysis('p1', good, 'r1', { notify: false });
    expect(first).toMatchObject({ saved: true, events: [] });
    expect(recordFullAnalysis('p1', good, 'r1')).toMatchObject({ saved: false, events: [] });
    const polluted = [...diabetesSite(HOST), ...Array.from({ length: 12 }, (_, i) => makePage(HOST, { path: `/phones/p${i}`, title: 'Phone', terms: PHONE_TERMS.map((t): [string, number] => [t, 4]) }))];
    const bad = buildRunReport(runOf('r2', polluted), undefined, '2026-10-08T00:00:00Z');
    const second = recordFullAnalysis('p1', bad, 'r2');
    expect(second.previous?.runId).toBe('r1');
    expect(readFocusHistory('p1')).toHaveLength(2);
    expect(second.events.some((e) => e.code === 'sfs-drop')).toBe(true);
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
  });

  it('fires Content Guard for off-topic pages first seen within 24 hours', async () => {
    enable('p1');
    const clock = () => Date.parse('2026-10-02T00:00:00Z');
    recordFullAnalysis('p1', buildRunReport(runOf('r1', diabetesSite(HOST))), 'r1', { clock, notify: false });
    const extra = Array.from({ length: 4 }, (_, i) => makePage(HOST, { path: `/phones/new-${i}`, title: 'Phone', terms: PHONE_TERMS.map((t): [string, number] => [t, 5]) }));
    const next = recordFullAnalysis('p1', buildRunReport(runOf('r2', [...diabetesSite(HOST), ...extra])), 'r2', { clock: () => clock() + 3_600_000, notify: false });
    expect(next.events.filter((e) => e.code === 'content-guard').length).toBeGreaterThan(0);
  });
});

describe('incremental scoring', () => {
  it('scores new pages against the existing model and alerts on off-topic arrivals', async () => {
    enable('p1');
    const base = buildRunReport(runOf('r1', diabetesSite(HOST)));
    const clock = () => 5_000_000;
    registerSeenUrls('p1', base.pages.map((page) => page.url), clock);
    const phone = makePage(HOST, { path: '/phones/new', title: 'Phone', terms: PHONE_TERMS.map((t): [string, number] => [t, 6]) });
    const good = makePage(HOST, { path: '/articles/new', title: 'Insulin', terms: DIABETES_TERMS.slice(0, 12).map((t): [string, number] => [t, 4]) });
    const outcome = applyIncremental('p1', base, [phone, good], `https://${HOST}/`, { clock: () => clock() + 1000 });
    expect(outcome.scored).toHaveLength(2);
    expect(outcome.report.pages.length).toBe(base.pages.length + 2);
    expect(outcome.events.map((e) => e.params.url)).toContain(`https://${HOST}/phones/new`);
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    expect(applyIncremental(undefined, base, [phone], `https://${HOST}/`).events).toEqual([]);
  });
});
