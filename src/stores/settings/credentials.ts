import { getSecureValue, setSecureValue } from '@/services/tauri';
import { activeProjectId, dataForSeoSecretNameFor, googleMetricsSecretNameFor } from './defaults';
import type { SettingsSet, SettingsGet, SettingsState } from './types';

export const createSettingsCredentials = (set: SettingsSet, _get: SettingsGet): Pick<SettingsState, 'loadDataForSeoCredentials' | 'loadGoogleMetricsApiKey' | 'saveDataForSeoCredentials' | 'saveGoogleMetricsApiKey'> => {
  const secureSaveQueues = new Map<string, Promise<void>>();
  const secureSaveRevisions = new Map<string, number>();
  const loadRevisions = new Map<string, number>();
  const invalidateLoad = (kind: string) => {
    const revision = (loadRevisions.get(kind) || 0) + 1;
    loadRevisions.set(kind, revision);
    return revision;
  };
  const hasPendingSave = (projectId: string) => secureSaveQueues.has('dataforseo-' + projectId) || secureSaveQueues.has('google-metrics-' + projectId);
  return {
    loadDataForSeoCredentials: async () => {
      const projectId = activeProjectId();
      const revision = invalidateLoad('dataforseo');
      const isCurrent = () => activeProjectId() === projectId && loadRevisions.get('dataforseo') === revision;
      if (!projectId) {
        set({ dataForSeoCredentials: { login: '', password: '' }, secureStorageError: null });
        return;
      }
      // Clear the previous project's in-memory secret before awaiting the new
      // keychain read. This prevents a fast project switch from using stale
      // credentials while the secure store responds.
      set({ dataForSeoCredentials: { login: '', password: '' }, secureStorageError: null });
      try {
        const pendingSave = secureSaveQueues.get('dataforseo-' + projectId);
        if (pendingSave) await pendingSave.catch(() => undefined);
        if (!isCurrent()) return;
        const [login, password] = await Promise.all([getSecureValue(dataForSeoSecretNameFor('login', projectId)), getSecureValue(dataForSeoSecretNameFor('password', projectId))]);
        if (!isCurrent()) return;
        set({ dataForSeoCredentials: { login, password }, secureStorageError: null });
      } catch (error) {
        if (isCurrent()) set({ secureStorageError: error instanceof Error ? error.message : String(error) });
      }
    },

    loadGoogleMetricsApiKey: async () => {
      const projectId = activeProjectId();
      const revision = invalidateLoad('google-metrics');
      const isCurrent = () => activeProjectId() === projectId && loadRevisions.get('google-metrics') === revision;
      if (!projectId) {
        set({ googleMetricsApiKey: '' });
        return;
      }
      set({ googleMetricsApiKey: '', secureStorageError: null });
      try {
        const pendingSave = secureSaveQueues.get('google-metrics-' + projectId);
        if (pendingSave) await pendingSave.catch(() => undefined);
        if (!isCurrent()) return;
        const apiKey = await getSecureValue(googleMetricsSecretNameFor(projectId));
        if (!isCurrent()) return;
        set({ googleMetricsApiKey: apiKey });
      } catch (error) {
        if (isCurrent()) set({ secureStorageError: error instanceof Error ? error.message : String(error) });
      }
    },

    saveDataForSeoCredentials: async (credentials) => {
      const projectId = activeProjectId();
      invalidateLoad('dataforseo');
      const queueKey = 'dataforseo-' + projectId;
      const revision = (secureSaveRevisions.get(queueKey) || 0) + 1;
      secureSaveRevisions.set(queueKey, revision);
      set({ isSaving: true, secureStorageError: null });
      const previous = secureSaveQueues.get(queueKey) || Promise.resolve();
      const save = previous.catch(() => undefined).then(() => Promise.allSettled([
        setSecureValue(dataForSeoSecretNameFor('login', projectId), credentials.login),
        setSecureValue(dataForSeoSecretNameFor('password', projectId), credentials.password),
      ])).then((results) => {
        const failed = results.find((result) => result.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
      });
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
        if (activeProjectId() === projectId && !hasPendingSave(projectId)) set({ isSaving: false });
      }
    },

    saveGoogleMetricsApiKey: async (apiKey) => {
      const projectId = activeProjectId();
      invalidateLoad('google-metrics');
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
        if (activeProjectId() === projectId && !hasPendingSave(projectId)) set({ isSaving: false });
      }
    },

  };
};
