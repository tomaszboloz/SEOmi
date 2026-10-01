import { create } from 'zustand';
import { AppConfig } from '@/types';
import { getSecureValue, invokeTauriCommand, setSecureValue } from '@/services/tauri';
import i18n, { setLanguageDirection } from '@/i18n';
import { readStorage, writeStorage } from '@/services/storage';
import { useProjectStore } from './projectStore';

interface SettingsState {
  config: AppConfig;
  theme: 'dark' | 'light' | 'system';
  language: string;
  isSaving: boolean;
  configError: string | null;
  dataForSeoCredentials: { login: string; password: string };
  googleMetricsApiKey: string;
  secureStorageError: string | null;

  loadConfig: () => Promise<void>;
  updateConfig: (patch: Partial<AppConfig>) => Promise<void>;
  loadDataForSeoCredentials: () => Promise<void>;
  saveDataForSeoCredentials: (credentials: { login: string; password: string }) => Promise<void>;
  loadGoogleMetricsApiKey: () => Promise<void>;
  saveGoogleMetricsApiKey: (apiKey: string) => Promise<void>;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setLanguage: (lang: string) => void;
}

const DEFAULT_CONFIG: AppConfig = {
  theme: 'dark',
  language: readStorage('seomi_language') || 'en',
  default_user_agent: 'chrome_mac',
  request_timeout_secs: 15,
  max_redirects: 10,
  verify_ssl: true,
  ai_provider: 'openai',
  ai_model: 'gpt-4o',
  auto_check_updates: true,
  auto_install_updates: false,
};

const activeProjectId = (): string => readStorage('seomi_active_project_v1') || useProjectStore.getState().activeProjectId || '';
const dataForSeoSecretNameFor = (kind: 'login' | 'password', projectId: string): string => {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(projectId)) throw new Error(i18n.t('runtimeErrors.settings.projectDataforseo'));
  return `dataforseo_${kind}_${projectId}`;
};
const googleMetricsSecretNameFor = (projectId: string): string => {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(projectId)) throw new Error(i18n.t('runtimeErrors.settings.projectGoogle'));
  return `google_metrics_api_key_${projectId}`;
};

// Keep config writes ordered. A slow native save must not finish after a
// newer theme/language update and restore the older snapshot on disk.
let configSaveQueue: Promise<void> = Promise.resolve();
let configUpdateRevision = 0;
const secureSaveQueues = new Map<string, Promise<void>>();
const secureSaveRevisions = new Map<string, number>();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  config: DEFAULT_CONFIG,
  theme: (readStorage('seomi_theme') as any) || 'dark',
  language: readStorage('seomi_language') || 'en',
  isSaving: false,
  configError: null,
  dataForSeoCredentials: { login: '', password: '' },
  googleMetricsApiKey: '',
  secureStorageError: null,

  loadConfig: async () => {
    try {
      const conf = await invokeTauriCommand<AppConfig>('get_config');
      set({ config: conf, theme: conf.theme, language: conf.language, configError: null });
      applyThemeToDOM(conf.theme);
      setLanguageDirection(conf.language);
      // Keep the legacy general settings record and the project aware AI
      // selector aligned after a restart. The selector remains the source of
      // truth for provider specific local subscription connections.
      const { useAuditStore } = await import('./auditStore');
      useAuditStore.getState().setSelectedUserAgent(conf.default_user_agent);
      const { useAuthStore } = await import('./authStore');
      if (conf.ai_provider === 'openai' || conf.ai_provider === 'claude' || conf.ai_provider === 'gemini') {
        useAuthStore.getState().setProvider(conf.ai_provider);
        if (conf.ai_model) useAuthStore.getState().setModel(conf.ai_model);
      }
    } catch {
      set({ configError: i18n.t('runtimeErrors.settings.configLoadFailed') });
    }
    // Credentials belong to a project. On the project gate there is deliberately
    // no project-scoped secret to read yet.
    if (activeProjectId()) await get().loadDataForSeoCredentials();
  },

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

  updateConfig: async (patch: Partial<AppConfig>) => {
    const updated = { ...get().config, ...patch };
    const revision = ++configUpdateRevision;
    set({ config: updated, isSaving: true, configError: null });

    if (patch.default_user_agent) {
      const { useAuditStore } = await import('./auditStore');
      useAuditStore.getState().setSelectedUserAgent(patch.default_user_agent);
    }

    if (patch.theme) {
      set({ theme: patch.theme });
      applyThemeToDOM(patch.theme);
      writeStorage('seomi_theme', patch.theme);
    }

    if (patch.language) {
      set({ language: patch.language });
      setLanguageDirection(patch.language);
    }

    const save = configSaveQueue
      .catch(() => undefined)
      .then(() => invokeTauriCommand('save_config', { config: updated }))
      .then(() => undefined);
    configSaveQueue = save;
    try {
      await save;
      if (revision === configUpdateRevision) set({ configError: null });
    } catch {
      if (revision === configUpdateRevision) set({ configError: i18n.t('runtimeErrors.settings.configSaveFailed') });
    } finally {
      if (revision === configUpdateRevision) set({ isSaving: false });
    }
  },

  setTheme: (theme) => {
    get().updateConfig({ theme });
  },

  setLanguage: (lang) => {
    get().updateConfig({ language: lang });
  },
}));

function applyThemeToDOM(theme: 'dark' | 'light' | 'system') {
  const root = document.documentElement;
  if (theme === 'system') {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', systemDark);
    root.classList.toggle('light', !systemDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }
}
