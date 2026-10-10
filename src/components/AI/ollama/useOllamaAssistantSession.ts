import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAsyncOperationScope } from '@/hooks/useAsyncOperationScope';
import { buildAiPrompt } from '@/services/ai/prompt';
import { parseAiSuggestionResponse, type AiSuggestionResponse } from '@/services/ai/parsing';
import { createOllamaChat } from '@/services/embeddings/ollamaChat';
import { discoverOllama, type OllamaModel } from '@/services/embeddings/ollamaDiscovery';
import { boundedOllamaInteger } from '@/services/embeddings/ollamaTransport';
import { useAIAssistantActions } from '../assistant/useAIAssistantActions';
import {
  OLLAMA_ASSISTANT_BASE_URL,
  OLLAMA_ASSISTANT_MAX_INSTRUCTION_CHARS,
  OLLAMA_ASSISTANT_MAX_OUTPUT_TOKENS,
  OLLAMA_ASSISTANT_MAX_PROMPT_CHARS,
  readOllamaAssistantMaxTokens,
  readOllamaAssistantInstruction,
  readOllamaAssistantModel,
  saveOllamaAssistantMaxTokens,
  saveOllamaAssistantInstruction,
  saveOllamaAssistantModel,
} from './ollamaAssistantStorage';

export type OllamaDiscoveryStatus = 'idle' | 'loading' | 'ready' | 'error';

export const useOllamaAssistantSession = (enabled: boolean) => {
  const { t } = useTranslation();
  const projectId = useProjectStore((state) => state.activeProjectId);
  const currentAudit = useAuditStore((state) => state.currentAudit);
  const setAuditData = useAuditStore((state) => state.setAuditData);
  const [model, setModel] = useState(() => readOllamaAssistantModel(projectId));
  const [maxOutputTokens, setMaxOutputTokens] = useState(() => readOllamaAssistantMaxTokens(projectId));
  const [instruction, setInstruction] = useState(() => readOllamaAssistantInstruction(projectId));
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<OllamaDiscoveryStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const ownerKey = JSON.stringify([projectId, currentAudit?.url, currentAudit?.timestamp, model, instruction, maxOutputTokens]);
  const beginOperation = useAsyncOperationScope(ownerKey);
  const beginDiscovery = useAsyncOperationScope(JSON.stringify([projectId, enabled]));
  const actions = useAIAssistantActions({ ownerKey, currentAudit, suggestions, setAuditData, setError: (message) => setError(message), beginOperation });

  useLayoutEffect(() => {
    setSuggestions(null);
    setLoading(false);
    setError(null);
  }, [ownerKey]);

  useEffect(() => {
    setModel(readOllamaAssistantModel(projectId));
    setMaxOutputTokens(readOllamaAssistantMaxTokens(projectId));
    setInstruction(readOllamaAssistantInstruction(projectId));
    setModels([]);
    setVersion(null);
    setStatus('idle');
    setError(null);
    setStorageError(null);
    setSuggestions(null);
    setLoading(false);
  }, [projectId]);

  const refreshDiscovery = useCallback(async () => {
    if (!projectId) {
      setStatus('error');
      setError(t('ollamaAssistantUi.errors.projectRequired'));
      return;
    }
    const isCurrent = beginDiscovery('discovery');
    setStatus('loading');
    setError(null);
    try {
      const discovered = await discoverOllama({ baseUrl: OLLAMA_ASSISTANT_BASE_URL });
      if (!isCurrent()) return;
      setVersion(discovered.version);
      setModels(discovered.models);
      const savedModel = readOllamaAssistantModel(projectId);
      if (savedModel && discovered.models.some((item) => item.name === savedModel)) setModel(savedModel);
      else if (model && discovered.models.some((item) => item.name === model)) setModel(model);
      else setModel('');
      setStatus('ready');
    } catch (cause) {
      if (!isCurrent()) return;
      setStatus('error');
      setModels([]);
      setVersion(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [beginDiscovery, model, projectId, t]);

  useEffect(() => {
    if (!enabled && status === 'loading') { setStatus('idle'); return; }
    if (enabled && status === 'idle') void refreshDiscovery();
  }, [enabled, refreshDiscovery, status]);

  const handleGenerate = async () => {
    const isCurrent = beginOperation('generate');
    setLoading(false);
    setError(null);
    setSuggestions(null);
    if (!projectId) return setError(t('ollamaAssistantUi.errors.projectRequired'));
    if (!currentAudit) return setError(t('ollamaAssistantUi.errors.auditRequired'));
    if (status !== 'ready' || !model || !models.some((item) => item.name === model)) return setError(t('ollamaAssistantUi.errors.modelRequired'));
    const prompt = buildAiPrompt(currentAudit, instruction || undefined);
    if (prompt.length > OLLAMA_ASSISTANT_MAX_PROMPT_CHARS) return setError(t('ollamaAssistantUi.errors.promptTooLarge'));
    setLoading(true);
    try {
      const chat = createOllamaChat({ baseUrl: OLLAMA_ASSISTANT_BASE_URL, model, maxOutputTokens });
      const result = await chat([{ role: 'user', content: prompt }]);
      const parsed = parseAiSuggestionResponse(result.text);
      if (isCurrent()) setSuggestions(parsed);
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  const handleMaxOutputTokensChange = (value: string) => {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) return;
    try {
      const bounded = boundedOllamaInteger(parsed, OLLAMA_ASSISTANT_MAX_OUTPUT_TOKENS, 'output tokens');
      setMaxOutputTokens(bounded);
      setStorageError(saveOllamaAssistantMaxTokens(projectId, bounded) ? null : t('runtimeErrors.persistence.workspaceUnavailable'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleModelChange = (value: string) => {
    if (!models.some((item) => item.name === value)) return;
    setModel(value);
    setStorageError(saveOllamaAssistantModel(projectId, value) ? null : t('runtimeErrors.persistence.workspaceUnavailable'));
  };

  const updateInstruction = (value: string) => {
    const bounded = value.slice(0, OLLAMA_ASSISTANT_MAX_INSTRUCTION_CHARS);
    setInstruction(bounded); setStorageError(saveOllamaAssistantInstruction(projectId, bounded) ? null : t('runtimeErrors.persistence.workspaceUnavailable'));
  };

  return {
    t, projectId, currentAudit, model, models, version, status, error: error ?? storageError, suggestions, instruction, maxOutputTokens, loading,
    maxInstructionChars: OLLAMA_ASSISTANT_MAX_INSTRUCTION_CHARS, setInstruction: updateInstruction,
    handleModelChange, handleMaxOutputTokensChange, refreshDiscovery, handleGenerate, ...actions,
  };
};
