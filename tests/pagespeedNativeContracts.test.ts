import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), projectId: null as string | null }));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: mocks.invoke }));
vi.mock('@/stores/projectStore', () => ({ useProjectStore: { getState: () => ({ activeProjectId: mocks.projectId }) } }));

import { queryCrux, runPageSpeedInsights } from '@/services/pagespeed';

describe('PageSpeed and CrUX native contracts', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.projectId = 'project-a';
  });
  afterEach(() => vi.useRealTimers());

  it.each(['mobile', 'desktop'] as const)('passes the trimmed URL and %s strategy without altering provider data', async (strategy) => {
    const providerReport = { source: 'provider', categories: { performance: null } };
    mocks.invoke.mockResolvedValue(providerReport);
    await expect(runPageSpeedInsights('  https://example.com/path  ', strategy)).resolves.toBe(providerReport);
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('run_pagespeed_insights', {
      projectId: 'project-a', url: 'https://example.com/path', strategy,
    });
  });

  it('reads the active project on every invocation after a project switch', async () => {
    mocks.invoke.mockResolvedValue({});
    await runPageSpeedInsights('https://one.example', 'mobile');
    mocks.projectId = 'project-b';
    await runPageSpeedInsights('https://two.example', 'desktop');
    expect(mocks.invoke.mock.calls.map(([, args]) => args.projectId)).toEqual(['project-a', 'project-b']);
  });

  it('blocks both providers before IPC when no project is selected', async () => {
    mocks.projectId = null;
    expect(() => runPageSpeedInsights('https://example.com', 'mobile')).toThrow();
    await expect(queryCrux('https://example.com', 'PHONE', 'url')).rejects.toThrow();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it.each(['url', 'origin'] as const)('preserves CrUX evidence and records the %s scope', async (scope) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    const response = { record: { metrics: {} } };
    mocks.invoke.mockResolvedValue(response);
    const result = await queryCrux('  https://example.com/path  ', 'TABLET', scope);
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('query_crux_record', {
      projectId: 'project-a', url: 'https://example.com/path', formFactor: 'TABLET', originScope: scope === 'origin',
    });
    expect(result).toEqual({ source: 'Chrome UX Report API (CrUX)', fetchedAt: '2026-10-01T12:00:00.000Z',
      target: 'https://example.com/path', scope, formFactor: 'TABLET', response });
    expect(result.response).toBe(response);
  });

  it('propagates provider failures without fabricating metrics', async () => {
    const failure = new Error('provider quota exceeded');
    mocks.invoke.mockRejectedValue(failure);
    await expect(runPageSpeedInsights('https://example.com', 'mobile')).rejects.toBe(failure);
    await expect(queryCrux('https://example.com', 'DESKTOP', 'origin')).rejects.toBe(failure);
  });
});
