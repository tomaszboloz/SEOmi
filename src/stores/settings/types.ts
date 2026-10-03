import type { StoreApi } from 'zustand';
import type { AppConfig } from '@/types';
export interface SettingsConsumers {
  applyUserAgent?: (userAgent: string) => void;
  applyAiSelection?: (provider: 'openai' | 'claude' | 'gemini', model: string) => void;
}

export interface SettingsState {
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
  bindConsumers: (consumers: SettingsConsumers) => () => void;
}

export type SettingsSet = StoreApi<SettingsState>['setState'];
export type SettingsGet = StoreApi<SettingsState>['getState'];
