import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { settingsHandlersHook } from './fixtures/settingsHandlersHook';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
const event = () => ({ preventDefault: vi.fn() }) as unknown as React.SyntheticEvent;

it('saves the exact current draft in order, prevents submit and retains success through its own store update', async () => {
  vi.useFakeTimers(); const f = settingsHandlersHook();
  act(() => { f.result.current.setDataforseoLogin('edited login'); f.result.current.setDataforseoPass('edited pass'); f.result.current.setGoogleMetricsKey('edited key'); });
  f.saveDataForSeoCredentials.mockImplementationOnce(async (credentials) => { useSettingsStore.setState({ dataForSeoCredentials: credentials }); });
  const e = event();
  await act(async () => f.result.current.handleSaveGeneral(e));
  expect(e.preventDefault).toHaveBeenCalledOnce();
  expect(f.saveDataForSeoCredentials).toHaveBeenCalledWith({ login: 'edited login', password: 'edited pass' });
  expect(f.saveGoogleMetricsApiKey).toHaveBeenCalledWith('edited key');
  expect(f.saveDataForSeoCredentials.mock.invocationCallOrder[0]).toBeLessThan(f.saveGoogleMetricsApiKey.mock.invocationCallOrder[0]);
  expect(f.result.current.savedSuccess).toBe(true);
  act(() => vi.advanceTimersByTime(2000));
  expect(f.result.current.savedSuccess).toBe(false);
});

it('does not save project secrets without an active project', async () => {
  const f = settingsHandlersHook(); act(() => useProjectStore.setState({ activeProjectId: null }));
  await act(async () => f.result.current.handleSaveGeneral(event()));
  expect(f.saveDataForSeoCredentials).not.toHaveBeenCalled();
  expect(f.saveGoogleMetricsApiKey).not.toHaveBeenCalled();
  expect(f.result.current.savedSuccess).toBe(false);
});

it.each(['dataforseo', 'google'] as const)('does not report success after current %s save failure', async (kind) => {
  const f = settingsHandlersHook();
  (kind === 'google' ? f.saveGoogleMetricsApiKey : f.saveDataForSeoCredentials).mockRejectedValueOnce(new Error('save failed'));
  await act(async () => f.result.current.handleSaveGeneral(event()));
  expect(f.result.current.savedSuccess).toBe(false);
  if (kind === 'dataforseo') expect(f.saveGoogleMetricsApiKey).not.toHaveBeenCalled();
});

it.each(['login', 'password'] as const)('requires nonempty %s before testing credentials', async (field) => {
  const f = settingsHandlersHook();
  act(() => field === 'login' ? f.result.current.setDataforseoLogin('  ') : f.result.current.setDataforseoPass(''));
  await act(async () => f.result.current.handleTestDataForSeo());
  expect(f.verify).not.toHaveBeenCalled();
  expect(f.result.current.dataForSeoTestStatus).toBe(i18n.t('dataforseo.enterCredentials'));
  expect(f.result.current.testingDataForSeo).toBe(false);
});

it('reports a successful explicit provider credential test', async () => {
  const f = settingsHandlersHook();
  await act(async () => f.result.current.handleTestDataForSeo());
  expect(f.verify).toHaveBeenCalledOnce();
  expect(f.result.current.dataForSeoTestStatus).toBe(i18n.t('dataforseo.connectionConfirmed'));
  expect(f.result.current.testingDataForSeo).toBe(false);
});

it.each([new Error('provider unavailable'), 'unknown failure'])('reports current provider test failure %s', async (error) => {
  const f = settingsHandlersHook(); f.verify.mockRejectedValueOnce(error);
  await act(async () => f.result.current.handleTestDataForSeo());
  expect(f.result.current.dataForSeoTestStatus).toBe(i18n.t('dataforseo.connectionFailed', { error: error instanceof Error ? error.message : i18n.t('auditProblems.unknown') }));
  expect(f.result.current.testingDataForSeo).toBe(false);
});

it.each(['openai', 'claude', 'gemini'] as const)('routes %s key changes and handles store failure', async (provider) => {
  const f = settingsHandlersHook(); f.setApiKey.mockRejectedValueOnce(new Error('store owns failure'));
  await act(async () => f.result.current.handleAiKeyChange(provider, 'key'));
  expect(f.setApiKey).toHaveBeenCalledWith(provider, 'key');
});

it('synchronizes each persisted credential kind without erasing the other edited draft', () => {
  const f = settingsHandlersHook();
  act(() => f.result.current.setGoogleMetricsKey('google draft'));
  act(() => useSettingsStore.setState({ dataForSeoCredentials: { login: 'new login', password: 'new password' } }));
  expect(f.result.current.googleMetricsKey).toBe('google draft');
  expect(f.result.current.dataforseoLogin).toBe('new login');
  expect(f.result.current.dataforseoPass).toBe('new password');
  act(() => f.result.current.setDataforseoLogin('login draft'));
  act(() => useSettingsStore.setState({ googleMetricsApiKey: 'persisted google' }));
  expect(f.result.current.dataforseoLogin).toBe('login draft');
  expect(f.result.current.googleMetricsKey).toBe('persisted google');
});

it('keeps current save success after the store normalizes its Google key', async () => {
  vi.useFakeTimers(); const f = settingsHandlersHook();
  act(() => f.result.current.setGoogleMetricsKey('  normalized key  '));
  f.saveGoogleMetricsApiKey.mockImplementationOnce(async (key: string) => { useSettingsStore.setState({ googleMetricsApiKey: key.trim() }); });
  await act(async () => f.result.current.handleSaveGeneral(event()));
  expect(f.saveGoogleMetricsApiKey).toHaveBeenCalledWith('  normalized key  ');
  expect(f.result.current.googleMetricsKey).toBe('normalized key');
  expect(f.result.current.savedSuccess).toBe(true);
});
