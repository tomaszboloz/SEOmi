import { getSecureValue, setSecureValue } from '@/services/tauri';
import { activeProjectId, dataForSeoSecretNameFor, googleMetricsSecretNameFor } from './defaults';
import { createSecureActions } from './secureActions';
import type { SettingsSet, SettingsGet, SettingsState } from './types';

export const createSettingsCredentials = (set: SettingsSet, _get: SettingsGet): Pick<SettingsState, 'loadDataForSeoCredentials' | 'loadGoogleMetricsApiKey' | 'saveDataForSeoCredentials' | 'saveGoogleMetricsApiKey'> => {
  const { loadSecure, saveSecure } = createSecureActions(set, activeProjectId);
  return {
    loadDataForSeoCredentials: () => loadSecure(
      { dataForSeoCredentials: { login: '', password: '' } },
      async (projectId) => {
        const [login, password] = await Promise.all([getSecureValue(dataForSeoSecretNameFor('login', projectId)), getSecureValue(dataForSeoSecretNameFor('password', projectId))]);
        return { dataForSeoCredentials: { login, password } };
      },
    ),

    loadGoogleMetricsApiKey: () => loadSecure(
      { googleMetricsApiKey: '' },
      async (projectId) => ({ googleMetricsApiKey: await getSecureValue(googleMetricsSecretNameFor(projectId)) }),
    ),

    saveDataForSeoCredentials: (credentials) => saveSecure('dataforseo', (projectId) => Promise.all([
      setSecureValue(dataForSeoSecretNameFor('login', projectId), credentials.login),
      setSecureValue(dataForSeoSecretNameFor('password', projectId), credentials.password),
    ]), () => set({ dataForSeoCredentials: credentials })),

    saveGoogleMetricsApiKey: (apiKey) => {
      const normalizedKey = apiKey.trim();
      return saveSecure('google-metrics', (projectId) => setSecureValue(googleMetricsSecretNameFor(projectId), normalizedKey), () => set({ googleMetricsApiKey: normalizedKey }));
    },
  };
};
