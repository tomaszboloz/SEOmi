import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/uiStore';
import { useAuditStore } from '@/stores/auditStore';
import { useAuthStore } from '@/stores/authStore';
import type { AiSuggestionResponse } from '@/services/ai';
import { useProjectStore } from '@/stores/projectStore';
import { useAsyncOperationScope } from '@/hooks/useAsyncOperationScope';
import { useAIAssistantActions } from './useAIAssistantActions';

export const useAIAssistantSession = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const closeModal = useUIStore((s) => s.closeModal);
  const openModal = useUIStore((s) => s.openModal);
  const currentAudit = useAuditStore((s) => s.currentAudit);
  const setAuditData = useAuditStore((s) => s.setAuditData);

  const provider = useAuthStore((s) => s.provider);
  const setProvider = useAuthStore((s) => s.setProvider);
  const model = useAuthStore((s) => s.model);
  const setModel = useAuthStore((s) => s.setModel);
  const apiKeys = useAuthStore((s) => s.apiKeys);
  const setApiKey = useAuthStore((s) => s.setApiKey);
  const connectionMethod = useAuthStore((s) => s.connectionMethod);
  const isProviderConnected = useAuthStore((s) => s.isProviderConnected);
  const generateSuggestions = useAuthStore((s) => s.generateSuggestions);

  const [promptInstruction, setPromptInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestionResponse | null>(null);

  const currentKey = apiKeys[provider] || '';
  const ownerKey = JSON.stringify([activeProjectId, provider, model, currentAudit?.url, currentAudit?.timestamp, connectionMethod[provider], currentKey, promptInstruction]);
  const beginOperation = useAsyncOperationScope(ownerKey);
  const actions = useAIAssistantActions({ ownerKey, currentAudit, suggestions, setAuditData, setError, beginOperation });

  useLayoutEffect(() => {
    setLoading(false);
    setSuggestions(null);
    setError(null);
  }, [ownerKey]);

  const handleApiKeyChange = (value: string) => {
    const isCurrent = beginOperation('key-write');
    const isErrorCurrent = beginOperation('error');
    beginOperation('generate');
    setLoading(false);
    setSuggestions(null);
    setError(null);
    void setApiKey(provider, value).catch((cause) => {
      if (isCurrent() && isErrorCurrent()) setError(cause instanceof Error ? cause.message : String(cause));
    });
  };

  const handleGenerate = async () => {
    const isCurrent = beginOperation('generate');
    const isErrorCurrent = beginOperation('error');
    setLoading(false);
    setError(null);
    setSuggestions(null);
    if (!currentAudit) return;
    if (!isProviderConnected()) {
      setError(t('ai.connectBeforeGenerate', { provider: provider.toUpperCase() }));
      return;
    }

    setLoading(true);

    try {
      const res = await generateSuggestions(currentAudit, promptInstruction);
      if (isCurrent()) setSuggestions(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isCurrent() && isErrorCurrent()) setError(msg);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  return {
    t,
    closeModal,
    openSubscriptionModal: () => openModal('subscription'),
    currentAudit,
    provider,
    setProvider,
    model,
    setModel,
    connectionMethod,
    currentKey,
    handleApiKeyChange,
    promptInstruction,
    setPromptInstruction,
    loading,
    error,
    suggestions,
    handleGenerate,
    ...actions,
  };
};
