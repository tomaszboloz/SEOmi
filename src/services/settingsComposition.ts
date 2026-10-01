import { useSettingsStore, type SettingsConsumers } from '@/stores/settingsStore';
import { useAuditStore } from '@/stores/auditStore';
import { useAuthStore } from '@/stores/authStore';

export interface SettingsComposition {
  bindConsumers: (consumers: SettingsConsumers) => () => void;
  setUserAgent: (userAgent: string) => void;
  setAiProvider: (provider: 'openai' | 'claude' | 'gemini') => void;
  setAiModel: (model: string) => void;
}

/** The application root wires consumers; settings never imports them back. */
export const connectSettingsStores = (dependencies: SettingsComposition = {
  bindConsumers: (consumers) => useSettingsStore.getState().bindConsumers(consumers),
  setUserAgent: (userAgent) => useAuditStore.getState().setSelectedUserAgent(userAgent),
  setAiProvider: (provider) => useAuthStore.getState().setProvider(provider),
  setAiModel: (model) => useAuthStore.getState().setModel(model),
}): (() => void) => dependencies.bindConsumers({
  applyUserAgent: dependencies.setUserAgent,
  applyAiSelection: (provider, model) => {
    dependencies.setAiProvider(provider);
    if (model) dependencies.setAiModel(model);
  },
});
