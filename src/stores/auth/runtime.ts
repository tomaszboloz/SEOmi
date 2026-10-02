import type { AiCliStatus, AiConnectionMethod, AiConnectionState, AiProvider } from '@/types';
import { createId } from '@/services/ids';
import { readStorage } from '@/services/storage';
import { currentModel } from '@/services/ai/modelCatalog';
import { CLAUDE_DEFAULT_MODEL } from '@/services/ai/claude';
import { GEMINI_DEFAULT_MODEL } from '@/services/ai/modelCatalog';
export const PROVIDERS: AiProvider[] = ['openai', 'claude', 'gemini'];
export const SECRET_NAMES: Record<AiProvider, string> = {
  openai: 'openai_api_key',
  claude: 'claude_api_key',
  gemini: 'gemini_api_key',
};
export const providerMap = <T,>(value: T): Record<AiProvider, T> => ({ openai: value, claude: value, gemini: value });
export const defaultModel = (provider: AiProvider): string => ({ openai: 'gpt-4o', claude: CLAUDE_DEFAULT_MODEL, gemini: GEMINI_DEFAULT_MODEL })[provider];
// Detection runs the same version and sign-in check as the explicit test for
// Codex and Claude, so a detected CLI is a working connection. Gemini has no
// sign-in check; only its explicit test (one real request) proves it.
const detectionProvesConnection = (provider: AiProvider): boolean => provider !== 'gemini';
export const statusFromDetectedCli = (provider: AiProvider, method: AiConnectionMethod, cli: AiCliStatus | null): AiConnectionState =>
  method === 'local_cli' && detectionProvesConnection(provider) && cli?.available ? 'connected' : 'unconfigured';
export const isAiProvider = (value: string | null): value is AiProvider => value === 'openai' || value === 'claude' || value === 'gemini';
export const isConnectionMethod = (value: string | null): value is AiConnectionMethod => value === 'api_key' || value === 'local_cli';
export const projectPreferenceKey = (projectId: string, suffix: string): string => `seomi_project_${encodeURIComponent(projectId)}_ai_${suffix}`;
export const AI_PROJECT_MIGRATION_KEY = 'seomi_ai_project_preferences_migrated_v1';
const authRequestTokens = new Map<string, string>();
export const apiKeySaveQueues = new Map<AiProvider, Promise<void>>();
export const beginAuthRequest = (kind: string): string => {
  const token = createId(`auth-${kind}`);
  authRequestTokens.set(kind, token);
  return token;
};
export const isLatestAuthRequest = (kind: string, token: string): boolean => authRequestTokens.get(kind) === token;

/**
 * Global (pre-project) preferences. Stored values are user-editable: an unknown
 * provider or connection method falls back to a default, and a missing model
 * uses the selected provider's default instead of an OpenAI model ID.
 */
export const resolveGlobalAiPreferences = (): { provider: AiProvider; model: string; connectionMethod: Record<AiProvider, AiConnectionMethod> } => {
  const storedProvider = readStorage('seomi_ai_provider');
  const provider = isAiProvider(storedProvider) ? storedProvider : 'openai';
  const model = currentModel(readStorage('seomi_ai_model')?.trim() || defaultModel(provider));
  const connectionMethod = PROVIDERS.reduce((all, item) => {
    const stored = readStorage(`seomi_ai_connection_${item}`);
    all[item] = isConnectionMethod(stored) ? stored : 'api_key';
    return all;
  }, providerMap<AiConnectionMethod>('api_key'));
  return { provider, model, connectionMethod };
};
