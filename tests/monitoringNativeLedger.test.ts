import { beforeEach, expect, it, vi } from 'vitest';
import { defaultMonitoringAlertSettings, readMonitoringHistory, reserveDispatch, type MonitoringAlert, type MonitoringAlertSettings } from '@/services/monitoringAlerts';

const NOW = '2026-10-10T12:00:00Z';
const alert = (fingerprint = 'fp', type: MonitoringAlert['type'] = 'crawl'): MonitoringAlert => ({ type, fingerprint, sourceId: 's', title: 't', body: 'b', occurredAt: NOW, partial: false, evidence: {} });
const settings = (patch: Partial<MonitoringAlertSettings> = {}): MonitoringAlertSettings => ({ ...defaultMonitoringAlertSettings(), enabled: true, frequency: 'daily', ...patch });
const desktop = () => true;
beforeEach(() => localStorage.clear());

it('uses the local ledger outside the desktop app', async () => {
  const invoke = vi.fn();
  const first = await reserveDispatch('n1', alert(), settings(), () => false, invoke);
  expect(first!.duplicate).toBe(false);
  expect(await first!.finish(true)).toBe(true);
  expect((await reserveDispatch('n1', alert(), settings(), () => false, invoke))!.duplicate).toBe(true);
  expect(invoke).not.toHaveBeenCalled();
  expect(readMonitoringHistory('n1')).toHaveLength(1);
});

it('declines invalid projects and disabled settings without calling the native side', async () => {
  const invoke = vi.fn();
  expect(await reserveDispatch('../bad', alert(), settings(), desktop, invoke)).toBeNull();
  expect(await reserveDispatch('n2', alert(), settings({ enabled: false }), desktop, invoke)).toBeNull();
  expect(await reserveDispatch('n2', alert(), settings({ types: { ...settings().types, crawl: false } }), desktop, invoke)).toBeNull();
  expect(invoke).not.toHaveBeenCalled();
});

it('lets the native ledger decide, record the delivery and mirror it locally', async () => {
  const invoke = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const reservation = await reserveDispatch('n3', alert(), settings(), desktop, invoke);
  expect(reservation!.duplicate).toBe(false);
  expect(invoke).toHaveBeenNthCalledWith(1, 'reserve_monitoring_alert', { projectId: 'n3', fingerprint: 'fp', alertType: 'crawl', frequency: 'daily' });
  expect(await reservation!.finish(true)).toBe(true);
  expect(invoke).toHaveBeenNthCalledWith(2, 'finish_monitoring_alert', expect.objectContaining({ occurredAt: NOW }));
  expect(readMonitoringHistory('n3')).toHaveLength(1);
});

it('reports a failed delivery as not persisted and releases the native reservation', async () => {
  const invoke = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false);
  const reservation = await reserveDispatch('n4', alert(), settings(), desktop, invoke);
  expect(await reservation!.finish(false)).toBe(false);
  expect(invoke).toHaveBeenLastCalledWith('finish_monitoring_alert', expect.objectContaining({ occurredAt: null }));
  const recordFails = vi.fn().mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('disk'));
  const next = await reserveDispatch('n4b', alert('x'), settings(), desktop, recordFails);
  expect(await next!.finish(true)).toBe(true);
});

it('a native duplicate suppresses the alert; a local duplicate releases the native reservation', async () => {
  const native = vi.fn().mockResolvedValue(true);
  const duplicate = await reserveDispatch('n5', alert(), settings(), desktop, native);
  expect(duplicate!.duplicate).toBe(true);
  expect(await duplicate!.finish(true)).toBe(false);
  expect(native).toHaveBeenCalledTimes(1);
  const seeded = await reserveDispatch('n6', alert(), settings(), () => false, vi.fn());
  await seeded!.finish(true);
  const invoke = vi.fn().mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('release failed'));
  const local = await reserveDispatch('n6', alert(), settings(), desktop, invoke);
  expect(local!.duplicate).toBe(true);
  expect(invoke).toHaveBeenLastCalledWith('finish_monitoring_alert', expect.objectContaining({ occurredAt: null }));
});

it('falls back to the local ledger when the native call fails', async () => {
  const invoke = vi.fn().mockRejectedValue(new Error('ipc down'));
  const reservation = await reserveDispatch('n7', alert(), settings(), desktop, invoke);
  expect(reservation!.duplicate).toBe(false);
  expect(await reservation!.finish(true)).toBe(true);
  expect((await reserveDispatch('n7', alert(), settings(), desktop, invoke))!.duplicate).toBe(true);
});

it('uses the real environment check by default', async () => {
  const reservation = await reserveDispatch('n8', alert(), settings());
  expect(reservation!.duplicate).toBe(false);
});
