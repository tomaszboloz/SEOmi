import { invokeTauriCommand } from '@/services/tauri';
import { AIService } from '@/services/ai';
import type { AiCliStatus } from '@/types';
import i18n from '@/i18n';
import { PROVIDERS, providerMap, statusFromDetectedCli, beginAuthRequest, isLatestAuthRequest } from './runtime';
import type { AuthState, AuthSet, AuthGet } from './types';
export const createAuthConnection = (set: AuthSet, get: AuthGet): Pick<AuthState, 'detectLocalClients' | 'testProviderConnection'> => ({
  detectLocalClients: async () => {
    const requestToken = beginAuthRequest('cli-detect');
    try {
      const statuses = await invokeTauriCommand<AiCliStatus[]>('detect_ai_clis');
      if (!isLatestAuthRequest('cli-detect', requestToken)) return;
      const cliStatus = PROVIDERS.reduce((all, provider) => ({ ...all, [provider]: statuses.find((status) => status.provider === provider) || null }), providerMap<AiCliStatus | null>(null));
      set((state) => {
        // Only fill in connections nobody has tested yet; an explicit test
        // result (connected, error or still running) is never replaced.
        const connectionStatus = { ...state.connectionStatus };
        const statusMessages = { ...state.statusMessages };
        for (const provider of PROVIDERS) {
          if (connectionStatus[provider] !== 'unconfigured') continue;
          connectionStatus[provider] = statusFromDetectedCli(provider, state.connectionMethod[provider], cliStatus[provider]);
          if (connectionStatus[provider] === 'connected') statusMessages[provider] = cliStatus[provider]?.detail || '';
        }
        return { cliStatus, connectionStatus, statusMessages };
      });
    } catch (error) {
      if (!isLatestAuthRequest('cli-detect', requestToken)) return;
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({ statusMessages: { ...state.statusMessages, [state.provider]: message } }));
    }
  },
  testProviderConnection: async (provider) => {
    const method = get().connectionMethod[provider];
    const requestToken = beginAuthRequest('connection-' + provider);
    set((state) => ({ connectionStatus: { ...state.connectionStatus, [provider]: 'testing' }, statusMessages: { ...state.statusMessages, [provider]: i18n.t('runtimeErrors.ai.checkingConnection') } }));
    let response: { success: boolean; message: string };
    try {
      response = method === 'local_cli'
        ? await AIService.testCliConnection(provider)
        : await AIService.testConnection(provider, get().apiKeys[provider]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      response = { success: false, message: i18n.t('runtimeErrors.ai.network', { detail }) };
    }
    if (!isLatestAuthRequest('connection-' + provider, requestToken)) return response;
    set((state) => ({
      connectionStatus: { ...state.connectionStatus, [provider]: response.success ? 'connected' : 'error' },
      statusMessages: { ...state.statusMessages, [provider]: response.message },
    }));
    // A working API key can list the provider's own models for the selector.
    if (response.success && method === 'api_key') void get().refreshProviderModels(provider);
    return response;
  },
});
