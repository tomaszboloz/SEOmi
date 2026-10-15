import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: send }));

import { saveMonitoringSettings, defaultMonitoringAlertSettings } from '@/services/monitoringAlerts';
import {
  FULL_INTERVAL_MS, INCREMENTAL_INTERVAL_MS, dueFocusJob, isCompletedRun, readFocusHistory, readFocusSchedule, runScheduledFocus, writeManualTopic, focusScheduleKey,
} from '@/services/siteFocusMonitoring';
import type { FocusPage } from '@/services/siteFocus';
import { diabetesSite, makePage, PHONE_TERMS } from './siteFocusFixtures';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const HOST = 'diabetes.test';
const runOf = (id: string, pages: FocusPage[], patch = {}) => createCrawlRunFixture({ id, startUrl: `https://${HOST}/`, result: createCrawlResultFixture({ pages, pages_crawled: pages.length, sitemap_urls: [] }), ...patch });
const enable = (project: string, patch = {}) => saveMonitoringSettings(project, { ...defaultMonitoringAlertSettings(), enabled: true, frequency: 'run', ...patch });

beforeEach(() => { localStorage.clear(); send.mockReset(); send.mockResolvedValue(true); });

describe('scheduling', () => {
  it('decides which job is due', () => {
    expect(dueFocusJob({}, 1)).toBe('full');
    expect(dueFocusJob({ lastFullAt: 0 }, FULL_INTERVAL_MS)).toBe('full');
    expect(dueFocusJob({ lastFullAt: 0 }, INCREMENTAL_INTERVAL_MS)).toBe('incremental');
    expect(dueFocusJob({ lastFullAt: 0, lastIncrementalAt: INCREMENTAL_INTERVAL_MS }, INCREMENTAL_INTERVAL_MS + 1)).toBeNull();
    expect(dueFocusJob({ lastFullAt: 0, lastIncrementalAt: 1 }, INCREMENTAL_INTERVAL_MS + 2)).toBe('incremental');
  });

  it('reads corrupt schedule state as empty', () => {
    localStorage.setItem(focusScheduleKey('p1'), JSON.stringify({ lastFullAt: 'x', lastIncrementalAt: 5 }));
    expect(readFocusSchedule('p1')).toEqual({ lastFullAt: undefined, lastIncrementalAt: 5 });
    expect(readFocusSchedule('p9')).toEqual({ lastFullAt: undefined, lastIncrementalAt: undefined });
  });

  it('runs the weekly full analysis with a report, then the daily incremental pass', async () => {
    enable('p1');
    writeManualTopic('p1', 'diabetes');
    let now = Date.parse('2026-10-01T00:00:00Z');
    const clock = () => now;
    const r1 = runOf('r1', diabetesSite(HOST));
    expect(isCompletedRun(r1)).toBe(true);
    expect(await runScheduledFocus('p1', r1, undefined, { clock })).toEqual({ job: 'full' });
    expect(readFocusHistory('p1')).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await runScheduledFocus('p1', r1, undefined, { clock })).toEqual({ job: null });

    now += INCREMENTAL_INTERVAL_MS + 1000;
    const added = makePage(HOST, { path: '/phones/x', title: 'Phone', terms: PHONE_TERMS.map((t): [string, number] => [t, 6]) });
    const r2 = runOf('r2', [...diabetesSite(HOST), added]);
    expect(await runScheduledFocus('p1', r2, undefined, { clock })).toEqual({ job: 'incremental', skipped: 'no-base' });
    expect(await runScheduledFocus('p1', r2, r1, { clock })).toEqual({ job: 'incremental' });
    await vi.waitFor(() => expect(send.mock.calls.length).toBeGreaterThan(1));

    now += INCREMENTAL_INTERVAL_MS + 1000;
    expect(await runScheduledFocus('p1', r1, r1, { clock })).toEqual({ job: 'incremental', skipped: 'no-changes' });

    now += FULL_INTERVAL_MS;
    expect(await runScheduledFocus('p1', r2, r1, { clock })).toEqual({ job: 'full' });
    expect(readFocusHistory('p1')).toHaveLength(2);
  });

  it('skips invalid input, disabled weekly delivery and swallows failures', async () => {
    const r = runOf('r1', diabetesSite(HOST));
    expect(await runScheduledFocus('../x', r, undefined)).toEqual({ job: null, skipped: 'invalid' });
    expect(await runScheduledFocus('p1', runOf('c', [], {}), undefined)).toEqual({ job: null, skipped: 'invalid' });
    expect(isCompletedRun(null)).toBe(false);
    expect(isCompletedRun(createCrawlRunFixture({ result: createCrawlResultFixture({ cancelled: true, pages: r.result.pages }) }))).toBe(false);
    expect(isCompletedRun(createCrawlRunFixture({ result: createCrawlResultFixture({ timed_out: true, pages: r.result.pages }) }))).toBe(false);
    expect(await runScheduledFocus('p1', r, undefined, { clock: () => 1 })).toEqual({ job: 'full' });
    expect(send).not.toHaveBeenCalled();
    saveMonitoringSettings('p2', { ...defaultMonitoringAlertSettings(), enabled: true, types: { ...defaultMonitoringAlertSettings().types, focus: false } });
    await runScheduledFocus('p2', r, undefined, { clock: () => 1 });
    expect(send).not.toHaveBeenCalled();
    enable('p3');
    send.mockImplementationOnce(async (_project: string, build: () => unknown) => { build(); throw new Error('no'); });
    await runScheduledFocus('p3', r, undefined, { clock: () => 1 });
    const broken = runOf('b', [{ url: null } as unknown as FocusPage]);
    expect(await runScheduledFocus('p4', broken, undefined)).toEqual({ job: null, skipped: 'error' });
  });
});
