import { AIService } from '@/services/ai';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';
import type { AuthState, AuthSet, AuthGet } from './types';
export const createAuthGeneration = (_set: AuthSet, get: AuthGet): Pick<AuthState, 'isProviderConnected' | 'generateText' | 'generateTextForProvider' | 'generateSuggestions'> => ({
  isProviderConnected: (provider) => get().connectionStatus[provider || get().provider] === 'connected',
  generateText: async (prompt, requestContext) => {
    const { provider, model, apiKeys, connectionMethod } = get();
    const activeProjectId = useProjectStore.getState().activeProjectId;
    if (requestContext && activeProjectId !== requestContext.projectId) {
      throw new Error('AI request context does not match the active project');
    }
    const options = requestContext ? { projectId: requestContext.projectId, requestContext } : { projectId: activeProjectId };
    return AIService.generateText(provider, apiKeys[provider], model, prompt, connectionMethod[provider], options);
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
