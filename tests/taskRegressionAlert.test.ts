import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: send }));

import '@/i18n';
import { defaultMonitoringAlertSettings, evaluateTaskRegressionAlert, monitorTaskRegression, readMonitoringHistory, saveMonitoringSettings } from '@/services/monitoringAlerts';
import type { MetricDelta } from '@/services/optimizationTasks/metricHistory';

const row = (taskId: string, delta: number, status: MetricDelta['status'] = 'failed'): MetricDelta => ({ taskId, module: 'sfs', url: `https://a.test/${taskId}`, delta, status, at: '2026-10-01T00:00:00Z' });
const AT = '2026-10-02T00:00:00.000Z';

beforeEach(() => { localStorage.clear(); send.mockReset(); send.mockResolvedValue(true); });

describe('metricHistory feeds the alert policy (#106)', () => {
  it('alerts on the worst verified drop that reaches the focus threshold', () => {
    const alert = evaluateTaskRegressionAlert([row('b', -6), row('a', -8), row('c', 4, 'verified'), row('d', -1)], 'task-regression-r1', undefined, AT);
    expect(alert).toMatchObject({ type: 'focus', sourceId: 'task-regression-r1', occurredAt: AT, partial: false });
    expect(alert?.evidence).toMatchObject({ tasks: 3, worst: -8, module: 'sfs', url: 'https://a.test/a' });
    expect(alert?.body).toContain('8');
    expect(evaluateTaskRegressionAlert([row('x', -7), row('m', -7), row('a', -7), row('z', -7)], 's', undefined, AT)?.evidence.url).toBe('https://a.test/a');
  });
  it('stays silent for improvements, unmeasured rows and small drops', () => {
    expect(evaluateTaskRegressionAlert([], 's')).toBeNull();
    expect(evaluateTaskRegressionAlert([row('a', 9, 'verified'), row('b', -2)], 's')).toBeNull();
    expect(evaluateTaskRegressionAlert([row('a', -4.9)], 's')).toBeNull();
    const settings = defaultMonitoringAlertSettings();
    settings.thresholds.focus.dropPoints = 1;
    expect(evaluateTaskRegressionAlert([row('a', -2)], 's', settings)).not.toBeNull();
    expect(evaluateTaskRegressionAlert([row('a', -5)], 's')?.occurredAt).toMatch(/^\d{4}-/u);
  });
  it('is delivered once through the shared policy and kept in history', async () => {
    saveMonitoringSettings('p1', { ...defaultMonitoringAlertSettings(), enabled: true, frequency: 'run' });
    const first = await monitorTaskRegression('p1', [row('a', -9)], 'r1');
    expect(first.persisted).toBe(true);
    expect(readMonitoringHistory('p1')).toHaveLength(1);
    expect((await monitorTaskRegression('p1', [row('a', -9)], 'r1')).duplicate).toBe(true);
    expect((await monitorTaskRegression('p2', [row('a', -9)], 'r1')).delivered).toBe(false);
  });
});
