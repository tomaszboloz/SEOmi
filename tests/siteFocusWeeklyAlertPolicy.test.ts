import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: send }));

import '@/i18n';
import { defaultMonitoringAlertSettings, deliverMonitoringAlert, readMonitoringHistory, saveMonitoringSettings } from '@/services/monitoringAlerts';
import { weeklyAlert } from '@/services/siteFocusMonitoring/weekly';

beforeEach(() => { localStorage.clear(); send.mockReset(); send.mockResolvedValue(true); });

describe('weekly digest goes through the monitoring policy (#106)', () => {
  it('builds a focus alert with a stable fingerprint and the digest text', () => {
    const alert = weeklyAlert({ score: 61.2, delta: -3.5, tasks: [] }, 'focus-weekly-r1', '2026-10-01T00:00:00.000Z');
    expect(alert).toMatchObject({ type: 'focus', sourceId: 'focus-weekly-r1', occurredAt: '2026-10-01T00:00:00.000Z', partial: false });
    expect(alert.evidence).toEqual({ kind: 'weekly', score: 61.2, delta: -3.5 });
    expect(weeklyAlert({ score: 61.2, delta: null, tasks: [] }, 'focus-weekly-r1', 'x').evidence.delta).toBe('none');
    expect(alert.fingerprint).toBe(weeklyAlert({ score: 61.2, delta: -3.5, tasks: [] }, 'focus-weekly-r1', 'later').fingerprint);
  });
  it('is persisted once per run and deduplicated; disabled projects stay silent', async () => {
    saveMonitoringSettings('p1', { ...defaultMonitoringAlertSettings(), enabled: true, frequency: 'run' });
    const alert = weeklyAlert({ score: 50, delta: null, tasks: [] }, 'focus-weekly-r1', '2026-10-01T00:00:00.000Z');
    expect((await deliverMonitoringAlert('p1', alert)).persisted).toBe(true);
    expect((await deliverMonitoringAlert('p1', alert)).duplicate).toBe(true);
    expect(readMonitoringHistory('p1')).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await deliverMonitoringAlert('p2', alert)).delivered).toBe(false);
  });
});
