import { readStorage, writeStorage } from '@/services/storage';
import type { AiConnectionMethod, AiConnectionState } from '@/types';
import { PROVIDERS, providerMap, defaultModel, statusFromDetectedCli, isAiProvider, isConnectionMethod, projectPreferenceKey, AI_PROJECT_MIGRATION_KEY, beginAuthRequest } from './runtime';
import type { AuthState, AuthSet, AuthGet } from './types';
export const createAuthPreferences = (set: AuthSet, get: AuthGet): Pick<AuthState, 'setProvider' | 'setModel' | 'setConnectionMethod' | 'hydrateProject'> => ({
  setProvider: (provider) => {
    writeStorage('seomi_ai_provider', provider);
    const projectId = get().activeProjectId;
    if (projectId) writeStorage(projectPreferenceKey(projectId, 'provider'), provider);
    const model = defaultModel(provider);
    writeStorage('seomi_ai_model', model);
    if (projectId) writeStorage(projectPreferenceKey(projectId, 'model'), model);
    set({ provider, model });
  },
  setModel: (model) => {
    writeStorage('seomi_ai_model', model);
    const projectId = get().activeProjectId;
    if (projectId) writeStorage(projectPreferenceKey(projectId, 'model'), model);
    set({ model });
  },
  setConnectionMethod: (provider, method) => {
    beginAuthRequest('connection-' + provider);
    writeStorage(`seomi_ai_connection_${provider}`, method);
    const projectId = get().activeProjectId;
    if (projectId) writeStorage(projectPreferenceKey(projectId, `connection_${provider}`), method);
    set((state) => {
      const status = statusFromDetectedCli(provider, method, state.cliStatus[provider]);
      return {
        connectionMethod: { ...state.connectionMethod, [provider]: method },
        connectionStatus: { ...state.connectionStatus, [provider]: status },
        statusMessages: { ...state.statusMessages, [provider]: status === 'connected' ? state.cliStatus[provider]?.detail || '' : '' },
      };
    });
  },
  hydrateProject: (projectId) => {
    const migrateLegacyPreferences = readStorage(AI_PROJECT_MIGRATION_KEY) !== '1';
    const storedProvider = readStorage(projectPreferenceKey(projectId, 'provider'));
    const legacyProvider = readStorage('seomi_ai_provider');
    const provider = isAiProvider(storedProvider)
      ? storedProvider
      : migrateLegacyPreferences && isAiProvider(legacyProvider)
        ? legacyProvider
        : 'openai';
    const storedModel = readStorage(projectPreferenceKey(projectId, 'model'));
    const legacyModel = readStorage('seomi_ai_model');
    const model = storedModel?.trim() || (migrateLegacyPreferences && provider === (legacyProvider || '') ? legacyModel?.trim() : '') || defaultModel(provider);
    const connectionMethod = PROVIDERS.reduce((all, item) => {
      const projectValue = readStorage(projectPreferenceKey(projectId, `connection_${item}`));
      const legacyValue = readStorage(`seomi_ai_connection_${item}`);
      all[item] = isConnectionMethod(projectValue)
        ? projectValue
        : migrateLegacyPreferences && isConnectionMethod(legacyValue)
          ? legacyValue
          : 'api_key';
      return all;
    }, providerMap<AiConnectionMethod>('api_key'));

    // Write the migrated values once so a later global preference change cannot
    // leak into an already initialized project.
    writeStorage(projectPreferenceKey(projectId, 'provider'), provider);
    writeStorage(projectPreferenceKey(projectId, 'model'), model);
    PROVIDERS.forEach((item) => writeStorage(projectPreferenceKey(projectId, `connection_${item}`), connectionMethod[item]));
    writeStorage(AI_PROJECT_MIGRATION_KEY, '1');
    // A signed-in local CLI stays connected across restarts and project
    // switches; an API credential still needs its explicit test.
    const cliStatus = get().cliStatus;
    const connectionStatus = PROVIDERS.reduce((all, item) => {
      all[item] = statusFromDetectedCli(item, connectionMethod[item], cliStatus[item]);
      return all;
    }, providerMap<AiConnectionState>('unconfigured'));
    set({
      activeProjectId: projectId,
      provider,
      model,
      connectionMethod,
      connectionStatus,
      statusMessages: PROVIDERS.reduce((all, item) => {
        all[item] = connectionStatus[item] === 'connected' ? cliStatus[item]?.detail || '' : '';
        return all;
      }, providerMap('')),
    });
  },
});
