import { create } from 'zustand';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import type { AuthState } from '@/stores/auth/types';
import { createAuthPreferences } from '@/stores/auth/preferences';
import { createAuthCredentials } from '@/stores/auth/credentials';
import { createAuthConnection } from '@/stores/auth/connection';
import { createAuthGeneration } from '@/stores/auth/generation';
import { AIService } from '@/services/ai';
import { invokeTauriCommand, setSecureValue } from '@/services/tauri';

vi.mock('@/services/tauri', () => ({
  getSecureValue: vi.fn().mockResolvedValue(''),
  setSecureValue: vi.fn().mockResolvedValue(undefined),
  invokeTauriCommand: vi.fn(),
}));
const store = () => create<AuthState>((set, get) => ({
  ...useAuthStore.getInitialState(),
  ...createAuthPreferences(set, get),
  ...createAuthCredentials(set, get),
  ...createAuthConnection(set, get),
  ...createAuthGeneration(set, get),
}));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => vi.restoreAllMocks());

it('composes project preferences without migrating later global selections into another project', () => {
  const auth = store();
  auth.getState().setProvider('claude');
  auth.getState().hydrateProject('first-project');
  auth.getState().setModel('chosen-model');
  auth.getState().hydrateProject('second-project');
  expect(auth.getState().provider).toBe('openai');
  auth.getState().hydrateProject('first-project');
  expect(auth.getState()).toMatchObject({ provider: 'claude', model: 'chosen-model' });
});

it('persists a credential and requires a fresh explicit test before API use is connected', async () => {
  const auth = store();
  await auth.getState().setApiKey('claude', 'saved-key');
  expect(setSecureValue).toHaveBeenCalledWith('claude_api_key', 'saved-key');
  expect(auth.getState().apiKeys.claude).toBe('saved-key');
  expect(auth.getState().isProviderConnected('claude')).toBe(false);
  vi.spyOn(AIService, 'testConnection').mockResolvedValue({ success: true, message: 'verified' });
  await auth.getState().testProviderConnection('claude');
  expect(auth.getState().isProviderConnected('claude')).toBe(true);
});

it('restores a checked local CLI without treating Gemini detection as authentication', async () => {
  const auth = store();
  auth.getState().setConnectionMethod('claude', 'local_cli');
  auth.getState().setConnectionMethod('gemini', 'local_cli');
  vi.mocked(invokeTauriCommand).mockResolvedValue([
    { provider: 'claude', available: true, command: 'claude', detail: 'signed in' },
    { provider: 'gemini', available: true, command: 'gemini', detail: 'installed' },
  ]);
  await auth.getState().detectLocalClients();
  expect(auth.getState().connectionStatus).toMatchObject({ claude: 'connected', gemini: 'unconfigured' });
});

it('routes generation through the selected provider and rejects an API-only provider for CLI generation', async () => {
  const auth = store();
  auth.getState().setProvider('claude');
  auth.getState().setModel('local-model');
  auth.getState().setConnectionMethod('claude', 'local_cli');
  const generate = vi.spyOn(AIService, 'generateText').mockResolvedValue('real-response-fixture');
  expect(await auth.getState().generateText('question')).toBe('real-response-fixture');
  expect(generate).toHaveBeenCalledWith('claude', '', 'local-model', 'question', 'local_cli');
  await expect(auth.getState().generateTextForProvider('openai', 'question')).rejects.toThrow();
});
