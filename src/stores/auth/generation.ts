import { AIService } from '@/services/ai';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';
import type { AuthState, AuthSet, AuthGet } from './types';
export const createAuthGeneration = (_set: AuthSet, get: AuthGet): Pick<AuthState, 'isProviderConnected' | 'generateText' | 'generateTextForProvider' | 'generateSuggestions'> => ({
  isProviderConnected: (provider) => get().connectionStatus[provider || get().provider] === 'connected',
  generateText: async (prompt) => {
    const { provider, model, apiKeys, connectionMethod } = get();
    const projectId = useProjectStore.getState().activeProjectId;
    return AIService.generateText(provider, apiKeys[provider], model, prompt, connectionMethod[provider], { projectId });
  },
  generateTextForProvider: async (provider, prompt) => {
    const { model, apiKeys, connectionMethod } = get();
    if (connectionMethod[provider] !== 'local_cli') {
      throw new Error(i18n.t('runtimeErrors.ai.localClientRequired', { provider }));
    }
    const projectId = useProjectStore.getState().activeProjectId;
    return AIService.generateText(provider, apiKeys[provider], model, prompt, 'local_cli', { projectId });
  },
  generateSuggestions: (audit, instruction) => {
    const { provider, model, apiKeys, connectionMethod } = get();
    const projectId = useProjectStore.getState().activeProjectId;
    return AIService.generateSuggestions(provider, apiKeys[provider], model, audit, instruction, connectionMethod[provider], { projectId });
  },
});
