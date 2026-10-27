import { getSecureValue, setSecureValue } from '@/services/tauri';
import { isTauriEnvironment } from '@/services/tauri/transport';
import { STORED_SECRET_MARKER } from '@/services/tauri/secrets';
import { activeProjectId, dataForSeoSecretNameFor, googleMetricsSecretNameFor } from './defaults';
import type { SettingsSet, SettingsGet, SettingsState } from './types';

export const createSettingsCredentials = (set: SettingsSet, get: SettingsGet): Pick<SettingsState, 'loadDataForSeoCredentials' | 'loadGoogleMetricsApiKey' | 'saveDataForSeoCredentials' | 'saveGoogleMetricsApiKey'> => {
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
      const existing = get().dataForSeoCredentials;
      const preserveLogin = isTauriEnvironment() && !credentials.login.trim() && existing.login === STORED_SECRET_MARKER;
      const preservePassword = isTauriEnvironment() && !credentials.password.trim() && existing.password === STORED_SECRET_MARKER;
      const save = previous.catch(() => undefined).then(() => Promise.allSettled([
        ...(preserveLogin ? [] : [setSecureValue(dataForSeoSecretNameFor('login', projectId), credentials.login)]),
        ...(preservePassword ? [] : [setSecureValue(dataForSeoSecretNameFor('password', projectId), credentials.password)]),
      ])).then((results) => {
        const failed = results.find((result) => result.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
      });
      secureSaveQueues.set(queueKey, save);
      try {
        await save;
        if (activeProjectId() === projectId && secureSaveRevisions.get(queueKey) === revision) {
          const storedValue = (value: string) => isTauriEnvironment() && value.trim() ? STORED_SECRET_MARKER : value;
          set({ dataForSeoCredentials: {
            login: preserveLogin ? existing.login : storedValue(credentials.login),
            password: preservePassword ? existing.password : storedValue(credentials.password),
          } });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (activeProjectId() === projectId && secureSaveRevisions.get(queueKey) === revision) set({ secureStorageError: message });
        throw error;
      } finally {
        if (secureSaveQueues.get(queueKey) === save) secureSaveQueues.delete(queueKey);
        // Clear for whichever project is active now; a switch mid-save must not leave the spinner on.
        const active = activeProjectId();
        if (!active || !hasPendingSave(active)) set({ isSaving: false });
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
      const existing = get().googleMetricsApiKey;
      const preserveExisting = isTauriEnvironment() && !normalizedKey && existing === STORED_SECRET_MARKER;
      const save = previous.catch(() => undefined).then(() => preserveExisting
        ? undefined
        : setSecureValue(googleMetricsSecretNameFor(projectId), normalizedKey)).then(() => undefined);
      secureSaveQueues.set(queueKey, save);
      try {
        await save;
        if (activeProjectId() === projectId && secureSaveRevisions.get(queueKey) === revision) {
          set({ googleMetricsApiKey: preserveExisting || (isTauriEnvironment() && normalizedKey)
            ? STORED_SECRET_MARKER
            : normalizedKey });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (activeProjectId() === projectId && secureSaveRevisions.get(queueKey) === revision) set({ secureStorageError: message });
        throw error;
      } finally {
        if (secureSaveQueues.get(queueKey) === save) secureSaveQueues.delete(queueKey);
        // Clear for whichever project is active now; a switch mid-save must not leave the spinner on.
        const active = activeProjectId();
        if (!active || !hasPendingSave(active)) set({ isSaving: false });
      }
    },

  };
};
