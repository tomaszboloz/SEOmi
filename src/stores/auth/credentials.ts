import { getSecureValue, setSecureValue } from '@/services/tauri';
import i18n from '@/i18n';
import { PROVIDERS, SECRET_NAMES, beginAuthRequest, isLatestAuthRequest, apiKeySaveQueues } from './runtime';
import type { AuthState, AuthSet, AuthGet } from './types';
export const createAuthCredentials = (set: AuthSet, _get: AuthGet): Pick<AuthState, 'setApiKey' | 'hydrateCredentials'> => ({
  setApiKey: async (provider, key) => {
    const requestToken = beginAuthRequest('key-' + provider);
    beginAuthRequest('credentials');
    const previous = apiKeySaveQueues.get(provider) || Promise.resolve();
    const save = previous.catch(() => undefined).then(() => setSecureValue(SECRET_NAMES[provider], key)).then(() => undefined);
    apiKeySaveQueues.set(provider, save);
    try {
      await save;
      if (!isLatestAuthRequest('key-' + provider, requestToken)) return;
      set((state) => ({
        apiKeys: { ...state.apiKeys, [provider]: key },
        connectionStatus: { ...state.connectionStatus, [provider]: 'unconfigured' },
        statusMessages: { ...state.statusMessages, [provider]: key.trim() ? i18n.t('runtimeErrors.ai.credentialSaved') : '' },
      }));
    } catch (error) {
      if (!isLatestAuthRequest('key-' + provider, requestToken)) return;
      const detail = error instanceof Error ? error.message : String(error);
      set((state) => ({
        connectionStatus: { ...state.connectionStatus, [provider]: 'error' },
        statusMessages: { ...state.statusMessages, [provider]: i18n.t('runtimeErrors.ai.network', { detail }) },
      }));
      throw error;
    } finally {
      if (apiKeySaveQueues.get(provider) === save) apiKeySaveQueues.delete(provider);
    }
  },
  hydrateCredentials: async () => {
    const requestToken = beginAuthRequest('credentials');
    try {
      const values = await Promise.all(PROVIDERS.map((provider) => getSecureValue(SECRET_NAMES[provider])));
      if (!isLatestAuthRequest('credentials', requestToken)) return;
      set({ apiKeys: { openai: values[0], claude: values[1], gemini: values[2] }, isHydrated: true });
    } catch (error) {
      if (!isLatestAuthRequest('credentials', requestToken)) return;
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({ isHydrated: true, statusMessages: { ...state.statusMessages, [state.provider]: message } }));
    }
  },
});
