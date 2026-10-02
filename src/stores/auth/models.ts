import { z } from 'zod';
import type { AiProvider } from '@/types';
import { listProviderModels, type AiModelOption } from '@/services/ai/modelList';
import { isHiddenModel } from '@/services/ai/modelCatalog';
import { readStorage, writeStorage } from '@/services/storage';
import { providerMap, beginAuthRequest, isLatestAuthRequest } from './runtime';
import type { AuthState, AuthSet, AuthGet } from './types';

// The model list is not secret; caching it keeps the select populated after a
// restart, before the key has been tested again.
const modelsKey = (provider: AiProvider): string => `seomi_ai_models_${provider}_v1`;
const StoredModels = z.array(z.object({ id: z.string().min(1).max(200), label: z.string().max(200) })).max(300);

export const readCachedModels = (provider: AiProvider): AiModelOption[] => {
  try {
    const parsed = StoredModels.safeParse(JSON.parse(readStorage(modelsKey(provider)) || '[]'));
    return parsed.success ? parsed.data.filter((model) => !isHiddenModel(model.id)) : [];
  } catch {
    return [];
  }
};

export const initialModelState = (): Pick<AuthState, 'availableModels' | 'modelListStatus'> => ({
  availableModels: { openai: readCachedModels('openai'), claude: readCachedModels('claude'), gemini: readCachedModels('gemini') },
  modelListStatus: providerMap<'idle' | 'loading' | 'error'>('idle'),
});

export const createAuthModels = (set: AuthSet, get: AuthGet): Pick<AuthState, 'refreshProviderModels'> => ({
  refreshProviderModels: async (provider) => {
    const apiKey = get().apiKeys[provider];
    if (get().connectionMethod[provider] !== 'api_key' || !apiKey.trim()) return;
    const token = beginAuthRequest('models-' + provider);
    set((state) => ({ modelListStatus: { ...state.modelListStatus, [provider]: 'loading' } }));
    try {
      const models = await listProviderModels(provider, apiKey);
      if (!isLatestAuthRequest('models-' + provider, token)) return;
      if (models.length) writeStorage(modelsKey(provider), JSON.stringify(models));
      set((state) => ({
        availableModels: { ...state.availableModels, [provider]: models.length ? models : state.availableModels[provider] },
        modelListStatus: { ...state.modelListStatus, [provider]: models.length ? 'idle' : 'error' },
      }));
    } catch {
      if (!isLatestAuthRequest('models-' + provider, token)) return;
      set((state) => ({ modelListStatus: { ...state.modelListStatus, [provider]: 'error' } }));
    }
  },
});
