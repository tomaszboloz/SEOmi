import { create } from 'zustand';
import type { AiProvider, AiConnectionMethod, AiConnectionState, AiCliStatus } from '@/types';
import { readStorage } from '@/services/storage';
import { PROVIDERS, providerMap } from './auth/runtime';
import type { AuthState } from './auth/types';
import { createAuthPreferences } from './auth/preferences';
import { createAuthCredentials } from './auth/credentials';
import { createAuthConnection } from './auth/connection';
import { createAuthGeneration } from './auth/generation';

export const useAuthStore = create<AuthState>((set, get) => ({
  subscription: { tier: 'direct' },
  activeProjectId: null,
  provider: (readStorage('seomi_ai_provider') as AiProvider) || 'openai',
  model: readStorage('seomi_ai_model') || 'gpt-4o',
  connectionMethod: PROVIDERS.reduce((all, provider) => ({
    ...all,
    [provider]: (readStorage(`seomi_ai_connection_${provider}`) as AiConnectionMethod) || 'api_key',
  }), providerMap<AiConnectionMethod>('api_key')),
  apiKeys: providerMap(''),
  connectionStatus: providerMap<AiConnectionState>('unconfigured'),
  statusMessages: providerMap(''),
  cliStatus: providerMap<AiCliStatus | null>(null),
  isHydrated: false,

  ...createAuthPreferences(set, get),
  ...createAuthCredentials(set, get),
  ...createAuthConnection(set, get),
  ...createAuthGeneration(set, get),
}));
