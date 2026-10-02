import { create } from 'zustand';
import type { AppConfig } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import i18n, { setLanguageDirection } from '@/i18n';
import { readStorage, writeStorage } from '@/services/storage';
import type { SettingsConsumers, SettingsState } from './settings/types';
import { DEFAULT_CONFIG, activeProjectId } from './settings/defaults';
import { createSettingsCredentials } from './settings/credentials';
import { applyThemeToDOM, initializeSettingsTheme } from './settings/theme';
export type { SettingsConsumers } from './settings/types';

// Keep config writes ordered. A slow native save must not finish after a
// newer theme/language update and restore the older snapshot on disk.
export const createSettingsStore = (dependencies: SettingsConsumers = {}) => {
  const storedTheme = readStorage('seomi_theme');
  let consumers = dependencies;
  const consumerBindings: Array<{ value: SettingsConsumers }> = [];
  let configSaveQueue: Promise<void> = Promise.resolve();
  let configUpdateRevision = 0;
  let configLoadRevision = 0;

  return create<SettingsState>((set, get) => ({
    config: DEFAULT_CONFIG,
    theme: storedTheme === 'light' || storedTheme === 'system' ? storedTheme : 'dark',
    language: readStorage('seomi_language') || 'en',
    isSaving: false,
    configError: null,
    dataForSeoCredentials: { login: '', password: '' },
    googleMetricsApiKey: '',
    secureStorageError: null,

    bindConsumers: (next) => {
      const binding = { value: next };
      consumerBindings.push(binding);
      consumers = next;
      return () => {
        const index = consumerBindings.indexOf(binding);
        if (index < 0) return;
        consumerBindings.splice(index, 1);
        consumers = consumerBindings.at(-1)?.value ?? dependencies;
      };
    },

    loadConfig: async () => {
      const revision = ++configLoadRevision;
      try {
        const conf = await invokeTauriCommand<AppConfig>('get_config');
        if (revision !== configLoadRevision) return;
        set({ config: conf, theme: conf.theme, language: conf.language, configError: null });
        applyThemeToDOM(conf.theme);
        setLanguageDirection(conf.language);
        // Keep the legacy general settings record and the project aware AI
        // selector aligned after a restart. The selector remains the source of
        // truth for provider specific local subscription connections.
        consumers.applyUserAgent?.(conf.default_user_agent);
        if (!readStorage('seomi_ai_provider') && (conf.ai_provider === 'openai' || conf.ai_provider === 'claude' || conf.ai_provider === 'gemini')) {
          consumers.applyAiSelection?.(conf.ai_provider, conf.ai_model || '');
        }
      } catch {
        if (revision === configLoadRevision) set({ configError: i18n.t('runtimeErrors.settings.configLoadFailed') });
      }
      // Credentials belong to a project. On the project gate there is deliberately
      // no project-scoped secret to read yet.
      if (activeProjectId()) await get().loadDataForSeoCredentials();
    },

    ...createSettingsCredentials(set, get),

    updateConfig: async (patch: Partial<AppConfig>) => {
      configLoadRevision += 1;
      const updated = { ...get().config, ...patch };
      const revision = ++configUpdateRevision;
      set({ config: updated, isSaving: true, configError: null });

      if (patch.default_user_agent) {
        consumers.applyUserAgent?.(patch.default_user_agent);
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
};

export const useSettingsStore = createSettingsStore();

initializeSettingsTheme(useSettingsStore);
