import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deliverMonitoringAlert, readMonitoringHistory, saveMonitoringSettings, defaultMonitoringAlertSettings, type MonitoringAlert, type MonitoringAlertFrequency } from '@/services/monitoringAlerts';

/** Pins the observable dispatch behaviour of the TS monitoring path before it moves behind the native ledger (#98). */
const send = vi.hoisted(() => vi.fn());
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: send }));
const NOW = new Date('2026-10-10T12:00:00Z');
const alert = (fingerprint: string, type: MonitoringAlert['type'] = 'crawl', occurredAt = NOW.toISOString()): MonitoringAlert =>
  ({ type, fingerprint, sourceId: fingerprint, title: `t-${fingerprint}`, body: 'b', occurredAt, partial: false, evidence: {} });
const enable = (frequency: MonitoringAlertFrequency, project: string) => saveMonitoringSettings(project, { ...defaultMonitoringAlertSettings(), enabled: true, frequency });
beforeEach(() => { localStorage.clear(); send.mockReset().mockResolvedValue(true); vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

it('does nothing for a missing alert, a disabled project or a disabled type', async () => {
  expect(await deliverMonitoringAlert('p1', null)).toMatchObject({ delivered: false, persisted: false, duplicate: false });
  expect(await deliverMonitoringAlert('p1', alert('a'))).toMatchObject({ delivered: false, duplicate: false });
  saveMonitoringSettings('p1', { ...defaultMonitoringAlertSettings(), enabled: true, types: { ...defaultMonitoringAlertSettings().types, crawl: false } });
  expect(await deliverMonitoringAlert('p1', alert('a'))).toMatchObject({ delivered: false });
  expect(send).not.toHaveBeenCalled();
});

it('delivers once per fingerprint, notifies with title and body and persists to history', async () => {
  enable('run', 'p2');
  expect(await deliverMonitoringAlert('p2', alert('a'))).toMatchObject({ delivered: true, persisted: true, duplicate: false });
  const [project, factory] = send.mock.calls[0];
  expect([project, factory()]).toEqual(['p2', { title: 't-a', body: 'b' }]);
  expect(await deliverMonitoringAlert('p2', alert('a'))).toMatchObject({ delivered: false, duplicate: true });
  expect(await deliverMonitoringAlert('p2', alert('b'))).toMatchObject({ delivered: true });
  expect(readMonitoringHistory('p2').map((item) => item.fingerprint)).toEqual(['a', 'b']);
  expect(send).toHaveBeenCalledTimes(2);
});

it('daily and weekly frequency suppress another alert of the same type inside the window only', async () => {
  enable('daily', 'p3');
  await deliverMonitoringAlert('p3', alert('a'));
  expect(await deliverMonitoringAlert('p3', alert('b'))).toMatchObject({ duplicate: true });
  expect(await deliverMonitoringAlert('p3', alert('c', 'semantic'))).toMatchObject({ delivered: true });
  vi.setSystemTime(new Date(NOW.getTime() + 25 * 3_600_000));
  expect(await deliverMonitoringAlert('p3', alert('d', 'crawl', new Date().toISOString()))).toMatchObject({ delivered: true });
  vi.setSystemTime(NOW);
  enable('weekly', 'w3');
  await deliverMonitoringAlert('w3', alert('a'));
  vi.setSystemTime(new Date(NOW.getTime() + 6 * 86_400_000));
  expect(await deliverMonitoringAlert('w3', alert('b', 'crawl', new Date().toISOString()))).toMatchObject({ duplicate: true });
  vi.setSystemTime(new Date(NOW.getTime() + 8 * 86_400_000));
  expect(await deliverMonitoringAlert('w3', alert('e', 'crawl', new Date().toISOString()))).toMatchObject({ delivered: true });
});

it('keeps projects separate and refuses a second in-flight delivery of the same alert', async () => {
  enable('run', 'p4');
  enable('run', 'q4');
  let release!: (value: boolean) => void;
  send.mockReturnValueOnce(new Promise<boolean>((resolve) => { release = resolve; }));
  const first = deliverMonitoringAlert('p4', alert('a'));
  expect(await deliverMonitoringAlert('p4', alert('a'))).toMatchObject({ duplicate: true });
  expect(await deliverMonitoringAlert('q4', alert('a'))).toMatchObject({ delivered: true });
  release(true);
  expect(await first).toMatchObject({ delivered: true });
});

it('a failed notification is not persisted and can be retried; email counts as a delivery', async () => {
  enable('run', 'p5');
  send.mockResolvedValueOnce(false);
  expect(await deliverMonitoringAlert('p5', alert('a'))).toMatchObject({ delivered: false, persisted: false, duplicate: false });
  expect(readMonitoringHistory('p5')).toEqual([]);
  const email = vi.fn().mockResolvedValue(true);
  send.mockResolvedValueOnce(false);
  expect(await deliverMonitoringAlert('p5', alert('a'), { email })).toMatchObject({ delivered: true, persisted: true, emailConfigured: true });
  const failing = vi.fn().mockRejectedValue(new Error('smtp'));
  send.mockResolvedValueOnce(false);
  expect(await deliverMonitoringAlert('p5', alert('z'), { email: failing })).toMatchObject({ delivered: false, emailConfigured: true });
});
