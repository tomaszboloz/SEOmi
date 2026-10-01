import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { createSettingsStore } from '@/stores/settingsStore';
import { connectSettingsStores } from '@/services/settingsComposition';

const transport = vi.hoisted(() => ({ invoke: vi.fn(), getSecret: vi.fn().mockResolvedValue('') }));
vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: transport.invoke, getSecureValue: transport.getSecret, setSecureValue: vi.fn(),
}));

afterEach(() => { localStorage.clear(); vi.clearAllMocks(); });

it('settings does not import consumer stores statically or dynamically', () => {
  const source = readFileSync('src/stores/settingsStore.ts', 'utf8');
  expect(source).not.toMatch(/(?:from\s+|import\s*\()\s*['"].*(?:auditStore|authStore)['"]/);
});

it('synchronizes a loaded configuration through injected consumer contracts', async () => {
  const applyUserAgent = vi.fn();
  const applyAiSelection = vi.fn();
  const store = createSettingsStore({ applyUserAgent, applyAiSelection });
  const config = { ...store.getState().config, default_user_agent: 'test-agent', ai_provider: 'gemini', ai_model: 'test-model' };
  transport.invoke.mockResolvedValueOnce(config);
  await store.getState().loadConfig();
  expect(applyUserAgent).toHaveBeenCalledExactlyOnceWith('test-agent');
  expect(applyAiSelection).toHaveBeenCalledExactlyOnceWith('gemini', 'test-model');
  expect(store.getState().config).toEqual(config);
});

it('applies user-agent changes without resetting provider-specific AI choices', async () => {
  const applyUserAgent = vi.fn();
  const applyAiSelection = vi.fn();
  const store = createSettingsStore({ applyUserAgent, applyAiSelection });
  transport.invoke.mockResolvedValueOnce(undefined);
  await store.getState().updateConfig({ default_user_agent: 'test-agent' });
  expect(applyUserAgent).toHaveBeenCalledExactlyOnceWith('test-agent');
  expect(applyAiSelection).not.toHaveBeenCalled();
  expect(transport.invoke).toHaveBeenCalledWith('save_config', expect.objectContaining({ config: expect.objectContaining({ default_user_agent: 'test-agent' }) }));
});

it('does not notify consumers when configuration read fails', async () => {
  const applyUserAgent = vi.fn();
  const applyAiSelection = vi.fn();
  const store = createSettingsStore({ applyUserAgent, applyAiSelection });
  const initial = store.getState().config;
  transport.invoke.mockRejectedValueOnce(new Error('unreadable config'));
  await store.getState().loadConfig();
  expect(applyUserAgent).not.toHaveBeenCalled();
  expect(applyAiSelection).not.toHaveBeenCalled();
  expect(store.getState().config).toEqual(initial);
  expect(store.getState().configError).toBeTruthy();
});

it('restores injected consumers after out-of-order disposal and repeated cleanup', async () => {
  const original = vi.fn();
  const old = vi.fn();
  const latest = vi.fn();
  const store = createSettingsStore({ applyUserAgent: original });
  const disposeOld = store.getState().bindConsumers({ applyUserAgent: old });
  const disposeLatest = store.getState().bindConsumers({ applyUserAgent: latest });
  disposeOld();
  await store.getState().updateConfig({ default_user_agent: 'latest' });
  expect(latest).toHaveBeenCalledExactlyOnceWith('latest');
  expect(old).not.toHaveBeenCalled();
  disposeLatest();
  disposeLatest();
  await store.getState().updateConfig({ default_user_agent: 'original' });
  expect(original).toHaveBeenCalledExactlyOnceWith('original');
});

it('composition preserves provider defaults for an empty saved model and can disconnect', () => {
  const bindConsumers = vi.fn();
  const disconnect = vi.fn();
  bindConsumers.mockReturnValue(disconnect);
  const setUserAgent = vi.fn();
  const setAiProvider = vi.fn();
  const setAiModel = vi.fn();
  expect(connectSettingsStores({ bindConsumers, setUserAgent, setAiProvider, setAiModel })).toBe(disconnect);
  const consumers = bindConsumers.mock.calls[0][0];
  consumers.applyUserAgent('agent');
  consumers.applyAiSelection('claude', '');
  expect(setUserAgent).toHaveBeenCalledExactlyOnceWith('agent');
  expect(setAiProvider).toHaveBeenCalledExactlyOnceWith('claude');
  expect(setAiModel).not.toHaveBeenCalled();
  consumers.applyAiSelection('gemini', 'selected-model');
  expect(setAiModel).toHaveBeenCalledExactlyOnceWith('selected-model');
});

it('configuration queues belong to individual store instances', async () => {
  let finishFirst!: () => void;
  transport.invoke.mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }));
  const first = createSettingsStore();
  const second = createSettingsStore();
  const pending = first.getState().updateConfig({ language: 'pl' });
  await vi.waitFor(() => expect(transport.invoke).toHaveBeenCalledTimes(1));
  await second.getState().updateConfig({ language: 'en' });
  expect(transport.invoke).toHaveBeenCalledTimes(2);
  expect(first.getState().isSaving).toBe(true);
  expect(second.getState().isSaving).toBe(false);
  finishFirst();
  await pending;
});

it('does not let an older config read overwrite a newer user edit', async () => {
  let finishRead!: (config: unknown) => void;
  const applyUserAgent = vi.fn();
  const store = createSettingsStore({ applyUserAgent });
  const staleConfig = { ...store.getState().config, default_user_agent: 'stale-agent' };
  transport.invoke.mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }));
  const pending = store.getState().loadConfig();
  await store.getState().updateConfig({ default_user_agent: 'new-agent' });
  finishRead(staleConfig);
  await pending;
  expect(store.getState().config.default_user_agent).toBe('new-agent');
  expect(applyUserAgent).toHaveBeenCalledExactlyOnceWith('new-agent');
});

it('does not let an older failed config read overwrite a successful reload', async () => {
  let rejectRead!: (error: Error) => void;
  const store = createSettingsStore();
  transport.invoke.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRead = reject; }));
  const pending = store.getState().loadConfig();
  transport.invoke.mockResolvedValueOnce(store.getState().config);
  await store.getState().loadConfig();
  rejectRead(new Error('stale failed read'));
  await pending;
  expect(store.getState().configError).toBeNull();
});
