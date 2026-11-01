import { beforeEach, expect, it, vi } from 'vitest';

const deliver = vi.hoisted(() => vi.fn());
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: deliver }));

import { evaluateTopSetChangeAlert, monitorTopSetChange } from '@/services/monitoringAlerts';
import { defaultMonitoringAlertSettings } from '@/services/monitoringAlerts/policy';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-15T00:00:00Z')); deliver.mockResolvedValue(true); localStorage.clear(); });

it('reports added and removed URLs with a bounded sample', () => {
  const alert = evaluateTopSetChangeAlert(['a', 'b', 'c'], ['a', 'd', 'e', 'f', 'g', 'h'], 'igos-top-1', 'seo');
  expect(alert?.type).toBe('semantic');
  expect(alert?.evidence).toMatchObject({ added: 5, removed: 2, addedSample: 'd e f', removedSample: 'b c' });
  expect(alert?.occurredAt).toBe('2026-01-15T00:00:00.000Z');
});

it('stays silent for an identical set or below the configured threshold', () => {
  expect(evaluateTopSetChangeAlert(['a', 'b'], ['b', 'a'], 's', 'seo')).toBeNull();
  const settings = defaultMonitoringAlertSettings();
  settings.thresholds.semantic.changes = 3;
  expect(evaluateTopSetChangeAlert(['a'], ['b'], 's', 'seo', settings)).toBeNull();
  expect(evaluateTopSetChangeAlert(['a'], ['b', 'c'], 's', 'seo', settings)).not.toBeNull();
});

it('delivers through the shared policy path and deduplicates', async () => {
  localStorage.setItem('seomi_project_p1_monitoring_alert_settings_v1', JSON.stringify({ enabled: true, frequency: 'run' }));
  const first = await monitorTopSetChange('p1', ['a'], ['b'], 'seo-1', 'seo');
  expect(first.alert?.sourceId).toBe('igos-top-seo-1');
  expect(first.persisted).toBe(true);
  expect((await monitorTopSetChange('p1', ['a'], ['b'], 'seo-1', 'seo')).duplicate).toBe(true);
});
