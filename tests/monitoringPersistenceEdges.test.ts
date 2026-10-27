import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readMonitoringHistory, reserveMonitoringAlert } from '@/services/monitoringAlerts/persistence';
import { defaultMonitoringAlertSettings, monitoringHistoryKey, MONITORING_HISTORY_LIMIT } from '@/services/monitoringAlerts/policy';
import type { MonitoringAlert } from '@/services/monitoringAlerts/types';

const settings = { ...defaultMonitoringAlertSettings(), enabled: true };
const alert = (fingerprint: string, type: MonitoringAlert['type'] = 'crawl'): MonitoringAlert => ({ type, fingerprint, sourceId: 'run', title: 'Change', body: 'Observed change', occurredAt: new Date().toISOString(), partial: false, evidence: {} });
const seed = (project: string, value: unknown) => localStorage.setItem(monitoringHistoryKey(project), JSON.stringify(value));

describe('monitoring reservation storage boundaries', () => {
  beforeEach(() => { localStorage.clear(); vi.useRealTimers(); });

  it('rejects invalid projects, disabled delivery and malformed stored history', () => {
    expect(readMonitoringHistory('../invalid')).toEqual([]);
    expect(reserveMonitoringAlert('../invalid', alert('a'), settings)).toBeNull();
    expect(reserveMonitoringAlert('disabled-edge', alert('a'), defaultMonitoringAlertSettings())).toBeNull();
    expect(reserveMonitoringAlert('type-disabled-edge', alert('a'), { ...settings, types: { ...settings.types, crawl: false } })).toBeNull();
    seed('history-object-edge', { not: 'an array' });
    expect(readMonitoringHistory('history-object-edge')).toEqual([]);
  });

  it('honors persisted fingerprints and frequency/type windows across sessions', () => {
    const current = alert('stored-edge');
    seed('persisted-edge', [current]);
    const duplicate = reserveMonitoringAlert('persisted-edge', current, settings);
    expect(duplicate?.duplicate).toBe(true);
    expect(duplicate?.finish(true)).toBe(false);
    expect(reserveMonitoringAlert('persisted-edge', alert('different-fingerprint'), settings)?.duplicate).toBe(true);
    const run = reserveMonitoringAlert('persisted-edge', alert('run-frequency'), { ...settings, frequency: 'run' });
    expect(run?.duplicate).toBe(false);
    run?.finish(false);
    const otherType = reserveMonitoringAlert('persisted-edge', alert('other-type', 'semantic'), settings);
    expect(otherType?.duplicate).toBe(false);
    otherType?.finish(false);
    seed('expired-edge', [{ ...current, occurredAt: '2000-01-01T00:00:00Z' }]);
    const expired = reserveMonitoringAlert('expired-edge', alert('after-expiry'), settings);
    expect(expired?.duplicate).toBe(false);
    expired?.finish(false);
  });

  it('keeps concurrent persisted delivery once and bounds project cache growth', () => {
    const current = alert('concurrent-edge');
    const reservation = reserveMonitoringAlert('concurrent-edge', current, settings);
    seed('concurrent-edge', [current]);
    expect(reservation?.finish(true)).toBe(true);
    expect(readMonitoringHistory('concurrent-edge')).toEqual([current]);
    for (let i = 0; i <= MONITORING_HISTORY_LIMIT; i++) {
      const project = `bounded-cache-${i}`;
      const item = alert(`fingerprint-${i}`);
      expect(reserveMonitoringAlert(project, item, { ...settings, frequency: 'run' })?.finish(true)).toBe(true);
    }
    localStorage.removeItem(monitoringHistoryKey('bounded-cache-0'));
    const evicted = reserveMonitoringAlert('bounded-cache-0', alert('fingerprint-0'), { ...settings, frequency: 'run' });
    expect(evicted?.duplicate).toBe(false);
    evicted?.finish(false);
  });

  it('allows another delivery after the daily window and refreshes its type cache', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(reserveMonitoringAlert('repeat-window-edge', alert('day-one'), settings)?.finish(true)).toBe(true);
    vi.advanceTimersByTime(86_400_001);
    expect(reserveMonitoringAlert('repeat-window-edge', alert('day-two'), settings)?.finish(true)).toBe(true);
    expect(reserveMonitoringAlert('repeat-window-edge', alert('day-two-retry'), settings)?.duplicate).toBe(true);
    vi.useRealTimers();
  });
});
