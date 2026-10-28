import { beforeEach, describe, expect, it } from 'vitest';
import {
  alertFingerprint,
  defaultMonitoringAlertSettings,
  monitoringHistoryKey,
} from '@/services/monitoringAlerts/policy';
import { evaluateScoreDropAlert } from '@/services/monitoringAlerts/scoreDrop';
import {
  readMonitoringHistory,
  reserveMonitoringAlert,
} from '@/services/monitoringAlerts/persistence';
import type { MonitoringAlert, MonitoringAlertSettings } from '@/services/monitoringAlerts/types';

beforeEach(() => {
  localStorage.clear();
});

describe('geminiAITrust07: Alert comparability, score drop boundaries and reservation', () => {
  it('distinguishes missing evidence from observed zero in evaluateScoreDropAlert', () => {
    const settings = defaultMonitoringAlertSettings();

    expect(evaluateScoreDropAlert('aio', undefined, { score: 70 }, 'src-1', settings)).toBeNull();
    expect(evaluateScoreDropAlert('aio', { score: NaN }, { score: 70 }, 'src-1', settings)).toBeNull();
    expect(evaluateScoreDropAlert('aio', { score: 80 }, { score: NaN }, 'src-1', settings)).toBeNull();
    expect(evaluateScoreDropAlert('trust', undefined, { score: 60 }, 'src-2', settings)).toBeNull();

    expect(evaluateScoreDropAlert('aio', { score: 80 }, { score: 80 }, 'src-1', settings)).toBeNull();
    expect(evaluateScoreDropAlert('aio', { score: 0 }, { score: 0 }, 'src-1', settings)).toBeNull();

    const zeroDrop = evaluateScoreDropAlert('aio', { score: 80 }, { score: 0 }, 'src-1', settings);
    expect(zeroDrop).not.toBeNull();
    expect(zeroDrop?.evidence).toMatchObject({ kind: 'aio', before: 80, after: 0, drop: 80, calibrationVersion: expect.any(String) });
  });

  it('applies independent threshold boundaries and distinct evidence schemas for aio vs trust', () => {
    const customSettings: MonitoringAlertSettings = {
      ...defaultMonitoringAlertSettings(),
      thresholds: {
        ...defaultMonitoringAlertSettings().thresholds,
        aio: { dropPoints: 10 },
        focus: { dropPoints: 5 },
      },
    };

    expect(evaluateScoreDropAlert('aio', { score: 80 }, { score: 70.01 }, 'aio-1', customSettings)).toBeNull();
    const aioHit = evaluateScoreDropAlert('aio', { score: 80 }, { score: 70 }, 'aio-1', customSettings);
    expect(aioHit).toMatchObject({
      type: 'aio',
      evidence: { kind: 'aio', before: 80, after: 70, drop: 10 },
    });

    expect(evaluateScoreDropAlert('trust', { score: 80 }, { score: 75 }, 'trust-1', customSettings)).toBeNull();
    const trustHit = evaluateScoreDropAlert('trust', { score: 80 }, { score: 74.9 }, 'trust-1', customSettings);
    expect(trustHit).toMatchObject({
      type: 'focus',
      evidence: { kind: 'trust', from: 80, to: 74.9, points: 5.1 },
    });
  });

  it('deduplicates reservations per project, clears failed delivery, and preserves project isolation', () => {
    const settings: MonitoringAlertSettings = {
      ...defaultMonitoringAlertSettings(),
      enabled: true,
      frequency: 'run',
    };

    const alertAlpha: MonitoringAlert = {
      type: 'aio',
      sourceId: 'crawl-100',
      title: 'AIO drop alert',
      body: 'Score dropped by 15 points',
      occurredAt: '2026-10-26T12:00:00.000Z',
      partial: false,
      fingerprint: alertFingerprint('aio', 'crawl-100', { drop: 15 }),
      evidence: { kind: 'aio', before: 85, after: 70, drop: 15 },
    };

    expect(reserveMonitoringAlert('invalid/id', alertAlpha, settings)).toBeNull();

    const reservation = reserveMonitoringAlert('proj-alpha', alertAlpha, settings);
    expect(reservation).not.toBeNull();
    expect(reservation?.duplicate).toBe(false);
    expect(reservation?.finish(true)).toBe(true);

    const historyAlpha = readMonitoringHistory('proj-alpha');
    expect(historyAlpha).toHaveLength(1);
    expect(historyAlpha[0].fingerprint).toBe(alertAlpha.fingerprint);

    const duplicateRes = reserveMonitoringAlert('proj-alpha', alertAlpha, settings);
    expect(duplicateRes?.duplicate).toBe(true);

    const betaRes = reserveMonitoringAlert('proj-beta', alertAlpha, settings);
    expect(betaRes?.duplicate).toBe(false);
    expect(readMonitoringHistory('proj-beta')).toHaveLength(0);

    const failedFinish = betaRes?.finish(false);
    expect(failedFinish).toBe(false);
    expect(readMonitoringHistory('proj-beta')).toHaveLength(0);
  });

  it('filters mixed persisted alert history, preserving valid survivors and enforcing read bounds', () => {
    const mixed = [
      null,
      'not-an-alert-object',
      { unexpected: true },
      { type: 'unsupported_type', fingerprint: 'fp-bad', sourceId: 's', title: 't', body: 'b', occurredAt: '2026-10-26T00:00:00Z' },
      { type: 'aio', sourceId: 's', title: 't', body: 'b', occurredAt: '2026-10-26T00:00:00Z' },
      { type: 'aio', fingerprint: 'fp-valid', sourceId: 'aio-1', title: 'AIO Alert', body: 'Drop', occurredAt: '2026-10-26T00:00:00Z', partial: false, evidence: { drop: 10 } },
    ];
    localStorage.setItem(monitoringHistoryKey('proj-mixed'), JSON.stringify(mixed));

    const survivors = readMonitoringHistory('proj-mixed');
    expect(survivors).toHaveLength(1);
    expect(survivors[0].fingerprint).toBe('fp-valid');
    expect(survivors[0].type).toBe('aio');
    expect(readMonitoringHistory('proj-isolated')).toEqual([]);

    const rawOverflow = Array.from({ length: 135 }, (_, i) => ({
      type: 'aio', fingerprint: `fp-${i}`, sourceId: `src-${i}`, title: 'T', body: 'B', occurredAt: '2026-10-26T00:00:00Z', partial: false, evidence: {},
    }));
    localStorage.setItem(monitoringHistoryKey('proj-overflow'), JSON.stringify(rawOverflow));
    const boundAlerts = readMonitoringHistory('proj-overflow');
    expect(boundAlerts).toHaveLength(128);
    expect(boundAlerts[0].fingerprint).toBe('fp-7');
    expect(boundAlerts[127].fingerprint).toBe('fp-134');
  });
});
