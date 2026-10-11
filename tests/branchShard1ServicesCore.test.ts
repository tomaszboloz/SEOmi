import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { testAiConnection } from '@/services/ai/connection';
import { reserveBudget, DataForSeoBudgetError } from '@/services/dataforseo/dataforseoBudgetGuard';
import { recordCost, writeBudget } from '@/services/dataforseo/dataforseoBudget';
import { appendDataForSeoTask, readDataForSeoTaskLog } from '@/services/dataforseo/dataforseoTaskLog';
import { deliverMonitoringAlert, saveMonitoringSettings, type MonitoringAlert } from '@/services/monitoringAlerts';

const send = vi.hoisted(() => vi.fn());
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: send }));

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('testAiConnection unsupported provider', () => {
  it('reports an unsupported provider without issuing a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await testAiConnection('unknown' as unknown as Parameters<typeof testAiConnection>[0], 'key');
    expect(result).toEqual({ success: false, message: i18n.t('runtimeErrors.ai.unsupported') });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('reserveBudget partial release', () => {
  it('keeps the remaining reservation when only one of two in-flight calls settles', () => {
    const project = 'shard1-budget';
    const endpoint = '/v3/shard1/endpoint';
    recordCost(project, endpoint, 0.5);
    writeBudget(project, { monthlyLimitUsd: 1.6, warnAtPercent: 80 });
    const r1 = reserveBudget(project, endpoint);
    const r2 = reserveBudget(project, endpoint);
    expect(() => reserveBudget(project, endpoint)).toThrow(DataForSeoBudgetError);
    r1();
    const r3 = reserveBudget(project, endpoint);
    expect(() => reserveBudget(project, endpoint)).toThrow(DataForSeoBudgetError);
    r2();
    r3();
    const r4 = reserveBudget(project, endpoint);
    r4();
  });
});

describe('appendDataForSeoTask without a window', () => {
  it('stores the record and skips the event when window is unavailable', () => {
    const meta = { endpoint: '/v3/x', requestedAt: 'a', completedAt: 'b', statusCode: 20000 } as unknown as Parameters<typeof appendDataForSeoTask>[0];
    vi.stubGlobal('window', undefined);
    const record = appendDataForSeoTask(meta, 'shard1-proj');
    vi.unstubAllGlobals();
    expect(record).toMatchObject({ projectId: 'shard1-proj', ok: true });
    expect(readDataForSeoTaskLog('shard1-proj')).toHaveLength(1);
  });
});

describe('deliverMonitoringAlert edge paths', () => {
  const alert = { type: 'gsc', sourceId: 'n', title: 'T', body: 'B', occurredAt: '2026-01-08T00:00:00Z', partial: false, evidence: {}, fingerprint: 'shard1-fp' } as MonitoringAlert;

  it('does not deliver when monitoring is disabled for the project', async () => {
    const result = await deliverMonitoringAlert('shard1-off', alert, { email: vi.fn() });
    expect(result).toEqual({ alert, delivered: false, persisted: false, duplicate: false, emailConfigured: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('treats rejecting desktop and email transports as undelivered and builds the notification lazily', async () => {
    saveMonitoringSettings('shard1-on', { enabled: true, frequency: 'run' });
    let built: unknown = null;
    send.mockReset().mockImplementation((_id: string, factory: () => unknown) => {
      built = factory();
      return Promise.reject(new Error('desktop down'));
    });
    const email = vi.fn().mockRejectedValue(new Error('smtp down'));
    const result = await deliverMonitoringAlert('shard1-on', alert, { email });
    expect(built).toEqual({ title: 'T', body: 'B' });
    expect(result).toMatchObject({ delivered: false, duplicate: false, emailConfigured: true });
  });
});
