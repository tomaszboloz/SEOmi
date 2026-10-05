import { create } from 'zustand';
import type { AiConnectionState, AiCliStatus } from '@/types';
import { providerMap, resolveGlobalAiPreferences } from './auth/runtime';
import type { AuthState } from './auth/types';
import { createAuthPreferences } from './auth/preferences';
import { createAuthCredentials } from './auth/credentials';
import { createAuthConnection } from './auth/connection';
import { createAuthGeneration } from './auth/generation';
import { createAuthModels, initialModelState } from './auth/models';

export const useAuthStore = create<AuthState>((set, get) => ({
  subscription: { tier: 'direct' },
  activeProjectId: null,
  ...resolveGlobalAiPreferences(),
  apiKeys: providerMap(''),
  connectionStatus: providerMap<AiConnectionState>('unconfigured'),
  statusMessages: providerMap(''),
  cliStatus: providerMap<AiCliStatus | null>(null),
  isHydrated: false,
  ...initialModelState(),

  ...createAuthPreferences(set, get),
  ...createAuthCredentials(set, get),
  ...createAuthConnection(set, get),
  ...createAuthGeneration(set, get),
  ...createAuthModels(set, get),
}));
