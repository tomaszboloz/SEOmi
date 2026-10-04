import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/uiStore';
import { useAuditStore } from '@/stores/auditStore';
import { useAuthStore } from '@/stores/authStore';
import type { AiSuggestionResponse } from '@/services/ai';
import { copyText } from '@/services/clipboard';
import { useTransientValue } from '@/hooks/useTransientValue';

export const useAIAssistantSession = () => {
  const { t } = useTranslation();
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
  const [copiedJson, setCopiedJson] = useTransientValue(false, 2000);
  const [appliedField, setAppliedField] = useTransientValue<'title' | 'desc' | null>(null, 2000);
  const generationRequestToken = useRef(0);

  const currentKey = apiKeys[provider] || '';

  useEffect(() => {
    generationRequestToken.current += 1;
    setLoading(false);
    setSuggestions(null);
  }, [provider, currentAudit?.timestamp]);

  const handleApiKeyChange = (value: string) => {
    void setApiKey(provider, value).catch((cause) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  };

  const handleGenerate = async () => {
    if (!currentAudit) return;
    if (!isProviderConnected()) {
      setError(t('ai.connectBeforeGenerate', { provider: provider.toUpperCase() }));
      return;
    }

    const requestToken = ++generationRequestToken.current;
    setLoading(true);
    setError(null);

    try {
      const res = await generateSuggestions(currentAudit, promptInstruction);
      if (generationRequestToken.current === requestToken) setSuggestions(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (generationRequestToken.current === requestToken) setError(msg);
    } finally {
      if (generationRequestToken.current === requestToken) setLoading(false);
    }
  };

  const applyTitle = () => {
    if (!currentAudit || !suggestions) return;
    const updated = {
      ...currentAudit,
      meta_tags: {
        ...currentAudit.meta_tags,
        title: suggestions.suggestedTitle,
        title_length: suggestions.suggestedTitle.length,
      },
      open_graph: {
        ...currentAudit.open_graph,
        og_title: suggestions.suggestedTitle,
      },
    };
    setAuditData(updated);
    setAppliedField('title');
  };

  const applyDescription = () => {
    if (!currentAudit || !suggestions) return;
    const updated = {
      ...currentAudit,
      meta_tags: {
        ...currentAudit.meta_tags,
        description: suggestions.suggestedDescription,
        description_length: suggestions.suggestedDescription.length,
      },
      open_graph: {
        ...currentAudit.open_graph,
        og_description: suggestions.suggestedDescription,
      },
    };
    setAuditData(updated);
    setAppliedField('desc');
  };

  const copySchema = async () => {
    if (!suggestions?.schemaJsonLd) return;
    const copied = await copyText(JSON.stringify(suggestions.schemaJsonLd, null, 2));
    if (!copied) return;
    setCopiedJson(true);
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
    copiedJson,
    appliedField,
    handleGenerate,
    applyTitle,
    applyDescription,
    copySchema,
  };
};
