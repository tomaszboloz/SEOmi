import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const send = vi.hoisted(() => vi.fn());
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: send }));
import {
  defaultMonitoringAlertSettings, monitorAioCrawls, monitoringHistoryKey, monitorScoreDrop,
  readMonitoringHistory, saveMonitoringSettings,
} from '@/services/monitoringAlerts';
import { afterAio, beforeAio } from './aioMonitoringFixtures';
import { createCrawlPageFixture } from './fixtures/crawl';

beforeEach(() => { localStorage.clear(); send.mockReset().mockResolvedValue(true); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const enable = (projectId: string, frequency: 'run' | 'daily' | 'weekly' = 'run') =>
  saveMonitoringSettings(projectId, { ...defaultMonitoringAlertSettings(), enabled: true, frequency });
const runAlert = (projectId: string, id = 'after', delivery = {}) => monitorAioCrawls(projectId,
  { ...afterAio(id), projectId }, [{ ...beforeAio(), projectId }], delivery);

describe('AIO monitoring delivery and persistence', () => {
  it('respects global opt-in and the AIO toggle independently of focus', async () => {
    expect((await runAlert('disabled-aio')).delivered).toBe(false);
    const settings = { ...defaultMonitoringAlertSettings(), enabled: true, frequency: 'run' as const };
    saveMonitoringSettings('disabled-type-aio', { ...settings, types: { ...settings.types, aio: false } });
    expect((await runAlert('disabled-type-aio')).delivered).toBe(false);
    saveMonitoringSettings('focus-disabled-aio', { ...settings, types: { ...settings.types, focus: false } });
    expect(await runAlert('focus-disabled-aio')).toMatchObject({ delivered: true, persisted: true, partial: false });
    expect(send).toHaveBeenCalledOnce();
    expect(readMonitoringHistory('focus-disabled-aio')[0].type).toBe('aio');
    expect((await runAlert('../invalid-project')).delivered).toBe(false);
  });

  it('persists an AIO alert once per run and reloads its fingerprint for deduplication', async () => {
    enable('run-aio');
    const first = await runAlert('run-aio');
    expect(first).toMatchObject({ delivered: true, persisted: true, duplicate: false });
    expect(await runAlert('run-aio')).toMatchObject({ delivered: false, duplicate: true });
    expect((await runAlert('run-aio', 'next')).delivered).toBe(true);
    const history = readMonitoringHistory('run-aio');
    expect(history).toHaveLength(2); expect(history[0]).toMatchObject({ type: 'aio', partial: false });
    localStorage.setItem(monitoringHistoryKey('reload-aio'), JSON.stringify(history));
    enable('reload-aio');
    expect((await runAlert('reload-aio')).duplicate).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it.each([['daily', 86_400_000], ['weekly', 7 * 86_400_000]] as const)('uses an independent %s frequency window', async (frequency, windowMs) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    const project = `frequency-aio-${frequency}`; enable(project, frequency);
    expect((await runAlert(project)).delivered).toBe(true);
    expect((await monitorScoreDrop(project, 'trust', { score: 90 }, { score: 50 }, 'trust')).delivered).toBe(true);
    vi.advanceTimersByTime(windowMs - 1);
    expect((await runAlert(project, 'next')).duplicate).toBe(true);
    vi.advanceTimersByTime(2);
    expect((await runAlert(project, 'next')).delivered).toBe(true);
    expect((await runAlert(project)).duplicate).toBe(true);
  });

  it('reserves a frequency window against parallel AIO deliveries', async () => {
    enable('parallel-aio', 'daily');
    let finish!: (sent: boolean) => void;
    send.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const pending = runAlert('parallel-aio');
    expect((await runAlert('parallel-aio', 'next')).duplicate).toBe(true);
    finish(true); expect((await pending).persisted).toBe(true);
  });

  it('retries failed delivery and supports email without desktop delivery', async () => {
    enable('retry-aio'); send.mockRejectedValueOnce(new Error('offline'));
    const email = vi.fn().mockRejectedValueOnce(new Error('email offline')).mockResolvedValueOnce(true);
    expect(await runAlert('retry-aio', 'after', { email })).toMatchObject({ delivered: false, persisted: false });
    expect(readMonitoringHistory('retry-aio')).toEqual([]);
    send.mockResolvedValueOnce(false);
    expect(await runAlert('retry-aio', 'after', { email })).toMatchObject({ delivered: true, persisted: true, emailConfigured: true });
    expect(email).toHaveBeenCalledTimes(2);
  });

  it('honestly reports unavailable scores without delivery, history or consuming frequency', async () => {
    enable('missing-aio', 'daily');
    const missing = { ...beforeAio(), projectId: 'missing-aio', result: { ...beforeAio().result, pages: [createCrawlPageFixture()] } };
    const current = { ...afterAio(), projectId: 'missing-aio' };
    expect(await monitorAioCrawls('missing-aio', current, [missing])).toMatchObject({ alert: null, partial: true, skipped: 'score-unavailable', delivered: false, persisted: false });
    expect(send).not.toHaveBeenCalled(); expect(readMonitoringHistory('missing-aio')).toEqual([]);
    expect((await runAlert('missing-aio')).delivered).toBe(true);
  });

  it('keeps delivery distinct from failed persistence and prevents another notification', async () => {
    enable('quota-aio');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(await runAlert('quota-aio')).toMatchObject({ delivered: true, persisted: false });
    expect((await runAlert('quota-aio')).duplicate).toBe(true);
    expect(send).toHaveBeenCalledOnce();
  });
});
