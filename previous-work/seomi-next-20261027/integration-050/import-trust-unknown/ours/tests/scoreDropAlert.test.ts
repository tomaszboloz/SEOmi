import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: send }));

import { defaultMonitoringAlertSettings, evaluateScoreDropAlert, monitorScoreDrop, saveMonitoringSettings, validAlert } from '@/services/monitoringAlerts';

describe('score drop alerts (AIO readiness and trust)', () => {
  beforeEach(() => {
    localStorage.clear();
    send.mockReset();
    send.mockResolvedValue(true);
  });

  it('uses the inclusive AIO threshold while preserving the strict trust threshold', () => {
    const alert = evaluateScoreDropAlert('aio', { score: 70 }, { score: 60 }, 'aio-run2');
    expect(alert).toMatchObject({ type: 'aio', sourceId: 'aio-run2', evidence: { kind: 'aio', before: 70, after: 60, drop: 10 } });
    expect(validAlert(alert)).toBe(true);
    expect(alert?.body).toContain('70');
    expect(evaluateScoreDropAlert('trust', { score: 70 }, { score: 65 }, 's')).toBeNull();
    expect(evaluateScoreDropAlert('trust', { score: 70 }, { score: 80 }, 's')).toBeNull();
  });

  it('stays silent without a previous snapshot or finite scores', () => {
    expect(evaluateScoreDropAlert('aio', undefined, { score: 10 }, 's')).toBeNull();
    expect(evaluateScoreDropAlert('aio', { score: Number.NaN }, { score: 10 }, 's')).toBeNull();
    expect(evaluateScoreDropAlert('aio', { score: 50 }, { score: Number.NaN }, 's')).toBeNull();
  });

  it('honors a custom threshold and fingerprints per kind and run', () => {
    const settings = defaultMonitoringAlertSettings();
    settings.thresholds.focus.dropPoints = 1;
    const a = evaluateScoreDropAlert('trust', { score: 70 }, { score: 67 }, 'trust-1', settings);
    const b = evaluateScoreDropAlert('trust', { score: 70 }, { score: 67 }, 'trust-2', settings);
    expect(a).not.toBeNull();
    expect(a?.fingerprint).not.toBe(b?.fingerprint);
  });

  it('delivers once and dedupes the same run', async () => {
    saveMonitoringSettings('p1', { ...defaultMonitoringAlertSettings(), enabled: true, frequency: 'run' });
    const first = await monitorScoreDrop('p1', 'aio', { score: 80 }, { score: 60 }, 'r2');
    expect(first.delivered).toBe(true);
    const again = await monitorScoreDrop('p1', 'aio', { score: 80 }, { score: 60 }, 'r2');
    expect(again.duplicate).toBe(true);
    expect((await monitorScoreDrop('p1', 'trust', undefined, { score: 60 }, 'r2')).alert).toBeNull();
  });
});
