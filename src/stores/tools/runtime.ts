
import { AiProvider } from '@/types';
import { isTauriEnvironment } from '@/services/tauri';
import { isStorageQuotaError } from '@/services/crawlPersistence';

import { createId } from '@/services/ids';

import { useAuthStore } from '../authStore';

import i18n from '@/i18n';

export const localSubscriptionProviders = async (): Promise<AiProvider[]> => {
  const providers = ['openai', 'claude', 'gemini'] as AiProvider[];
  const auth = useAuthStore.getState();
  await Promise.all(providers
    .filter((provider) => auth.connectionMethod[provider] === 'local_cli' && auth.connectionStatus[provider] === 'unconfigured')
    .map((provider) => auth.testProviderConnection(provider)));
  const current = useAuthStore.getState();
  return providers.filter((provider) => current.connectionMethod[provider] === 'local_cli' && current.isProviderConnected(provider));
};

export const toolRequestTokens = new Map<string, string>();

export const beginToolRequest = (kind: string): string => {
  const token = createId(`tool-${kind}`);
  toolRequestTokens.set(kind, token);
  return token;
};

export const isLatestToolRequest = (kind: string, token: string): boolean => toolRequestTokens.get(kind) === token;

export const formatCrawlPersistenceNotice = (saveResult: { prunedRuns: number; compactedRuns?: number }, retainedRuns: number): string | null => {
  const messages: string[] = [];
  if (saveResult.prunedRuns > 0) {
    messages.push(i18n.t('runtimeErrors.tools.quotaLimit', { retained: retainedRuns, removed: saveResult.prunedRuns }));
  }
  if ((saveResult.compactedRuns || 0) > 0) {
    messages.push(i18n.t('runtimeErrors.tools.quotaCompacted'));
  }
  return messages.length ? messages.join(' ') : null;
};

export const formatCrawlRuntimeError = (error: unknown): string => {
  if (isStorageQuotaError(error)) {
    return i18n.t(isTauriEnvironment() ? 'runtimeErrors.persistence.diskQuota' : 'runtimeErrors.persistence.localQuota');
  }
  return error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.externalCheckFailed');
};

export const errorMessage = (error: unknown, fallback: string): string => error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;