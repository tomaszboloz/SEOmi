import type { StoreApi } from 'zustand';
import type { AiCliStatus, AiConnectionMethod, AiConnectionState, AiProvider, UserSubscription } from '@/types';
import type { AIService } from '@/services/ai';
import type { AiModelOption } from '@/services/ai/modelList';
export interface AuthState {
  subscription: UserSubscription;
  activeProjectId: string | null;
  provider: AiProvider;
  model: string;
  connectionMethod: Record<AiProvider, AiConnectionMethod>;
  apiKeys: Record<AiProvider, string>;
  connectionStatus: Record<AiProvider, AiConnectionState>;
  statusMessages: Record<AiProvider, string>;
  cliStatus: Record<AiProvider, AiCliStatus | null>;
  isHydrated: boolean;
  /** Models returned by each provider's API for the stored key (or cached from the last successful listing). */
  availableModels: Record<AiProvider, AiModelOption[]>;
  modelListStatus: Record<AiProvider, 'idle' | 'loading' | 'error'>;
  refreshProviderModels: (provider: AiProvider) => Promise<void>;
  setProvider: (provider: AiProvider) => void;
  setModel: (model: string) => void;
  setConnectionMethod: (provider: AiProvider, method: AiConnectionMethod) => void;
  hydrateProject: (projectId: string) => void;
  setApiKey: (provider: AiProvider, key: string) => Promise<void>;
  hydrateCredentials: () => Promise<void>;
  detectLocalClients: () => Promise<void>;
  testProviderConnection: (provider: AiProvider) => Promise<{ success: boolean; message: string }>;
  isProviderConnected: (provider?: AiProvider) => boolean;
  generateText: (prompt: string) => Promise<string>;
  generateTextForProvider: (provider: AiProvider, prompt: string) => Promise<string>;
  generateSuggestions: (audit: Parameters<typeof AIService.generateSuggestions>[3], instruction?: string) => ReturnType<typeof AIService.generateSuggestions>;
}

export type AuthSet = StoreApi<AuthState>['setState'];
export type AuthGet = StoreApi<AuthState>['getState'];
