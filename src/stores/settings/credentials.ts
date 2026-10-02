import { getSecureValue, setSecureValue } from '@/services/tauri';
import { activeProjectId, dataForSeoSecretNameFor, googleMetricsSecretNameFor } from './defaults';
import type { SettingsSet, SettingsGet, SettingsState } from './types';

export const createSettingsCredentials = (set: SettingsSet, _get: SettingsGet): Pick<SettingsState, 'loadDataForSeoCredentials' | 'loadGoogleMetricsApiKey' | 'saveDataForSeoCredentials' | 'saveGoogleMetricsApiKey'> => {
  const secureSaveQueues = new Map<string, Promise<void>>();
  const secureSaveRevisions = new Map<string, number>();
  return {
    loadDataForSeoCredentials: async () => {
      const projectId = activeProjectId();
      if (!projectId) {
        set({ dataForSeoCredentials: { login: '', password: '' }, secureStorageError: null });
        return;
      }
      // Clear the previous project's in-memory secret before awaiting the new
      // keychain read. This prevents a fast project switch from using stale
      // credentials while the secure store responds.
      set({ dataForSeoCredentials: { login: '', password: '' }, secureStorageError: null });
      try {
        const [login, password] = await Promise.all([getSecureValue(dataForSeoSecretNameFor('login', projectId)), getSecureValue(dataForSeoSecretNameFor('password', projectId))]);
        if (activeProjectId() !== projectId) return;
        set({ dataForSeoCredentials: { login, password }, secureStorageError: null });
      } catch (error) {
        if (activeProjectId() === projectId) set({ secureStorageError: error instanceof Error ? error.message : String(error) });
      }
    },

    loadGoogleMetricsApiKey: async () => {
      const projectId = activeProjectId();
      if (!projectId) {
        set({ googleMetricsApiKey: '' });
        return;
      }
      set({ googleMetricsApiKey: '', secureStorageError: null });
      try {
        const apiKey = await getSecureValue(googleMetricsSecretNameFor(projectId));
        if (activeProjectId() !== projectId) return;
        set({ googleMetricsApiKey: apiKey });
      } catch (error) {
        if (activeProjectId() === projectId) set({ secureStorageError: error instanceof Error ? error.message : String(error) });
      }
    },

    saveDataForSeoCredentials: async (credentials) => {
      const projectId = activeProjectId();
      const queueKey = 'dataforseo-' + projectId;
      const revision = (secureSaveRevisions.get(queueKey) || 0) + 1;
      secureSaveRevisions.set(queueKey, revision);
      set({ isSaving: true, secureStorageError: null });
      const previous = secureSaveQueues.get(queueKey) || Promise.resolve();
      const save = previous.catch(() => undefined).then(() => Promise.all([
        setSecureValue(dataForSeoSecretNameFor('login', projectId), credentials.login),
        setSecureValue(dataForSeoSecretNameFor('password', projectId), credentials.password),
      ])).then(() => undefined);
      secureSaveQueues.set(queueKey, save);
      try {
        await save;
        if (activeProjectId() === projectId && secureSaveRevisions.get(queueKey) === revision) set({ dataForSeoCredentials: credentials });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (activeProjectId() === projectId && secureSaveRevisions.get(queueKey) === revision) set({ secureStorageError: message });
        throw error;
      } finally {
        if (secureSaveQueues.get(queueKey) === save) secureSaveQueues.delete(queueKey);
        if (activeProjectId() === projectId && secureSaveQueues.size === 0) set({ isSaving: false });
      }
    },

    saveGoogleMetricsApiKey: async (apiKey) => {
      const projectId = activeProjectId();
      const queueKey = 'google-metrics-' + projectId;
      const revision = (secureSaveRevisions.get(queueKey) || 0) + 1;
      secureSaveRevisions.set(queueKey, revision);
      set({ isSaving: true, secureStorageError: null });
      const previous = secureSaveQueues.get(queueKey) || Promise.resolve();
      const normalizedKey = apiKey.trim();
      const save = previous.catch(() => undefined).then(() => setSecureValue(googleMetricsSecretNameFor(projectId), normalizedKey)).then(() => undefined);
      secureSaveQueues.set(queueKey, save);
      try {
        await save;
        if (activeProjectId() === projectId && secureSaveRevisions.get(queueKey) === revision) set({ googleMetricsApiKey: normalizedKey });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (activeProjectId() === projectId && secureSaveRevisions.get(queueKey) === revision) set({ secureStorageError: message });
        throw error;
      } finally {
        if (secureSaveQueues.get(queueKey) === save) secureSaveQueues.delete(queueKey);
        if (activeProjectId() === projectId && secureSaveQueues.size === 0) set({ isSaving: false });
      }
    },

  };
};
