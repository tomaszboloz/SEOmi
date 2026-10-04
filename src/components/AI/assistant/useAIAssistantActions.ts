import { useLayoutEffect, useState } from 'react';
import type { PageAuditData } from '@/types';
import type { AiSuggestionResponse } from '@/services/ai';
import { copyText } from '@/services/clipboard';
import type { useAsyncOperationScope } from '@/hooks/useAsyncOperationScope';

interface AssistantActionsParams {
  ownerKey: string;
  currentAudit: PageAuditData | null;
  suggestions: AiSuggestionResponse | null;
  setAuditData: (data: PageAuditData) => void;
  setError: (message: string) => void;
  beginOperation: ReturnType<typeof useAsyncOperationScope>;
}

export function useAIAssistantActions({ ownerKey, currentAudit, suggestions, setAuditData, setError, beginOperation }: AssistantActionsParams) {
  const [copiedJson, setCopiedJson] = useState(false);
  const [appliedField, setAppliedField] = useState<'title' | 'desc' | null>(null);
  useLayoutEffect(() => {
    beginOperation('copy');
    beginOperation('apply-feedback');
    setCopiedJson(false);
    setAppliedField(null);
  }, [ownerKey, suggestions, beginOperation]);

  const applyMetadata = (field: 'title' | 'desc') => {
    if (!currentAudit || !suggestions) return;
    const isCurrent = beginOperation('apply-feedback');
    const title = field === 'title';
    const value = title ? suggestions.suggestedTitle : suggestions.suggestedDescription;
    setAuditData({
      ...currentAudit,
      meta_tags: {
        ...currentAudit.meta_tags,
        [title ? 'title' : 'description']: value,
        [title ? 'title_length' : 'description_length']: value.length,
      },
      open_graph: { ...currentAudit.open_graph, [title ? 'og_title' : 'og_description']: value },
    });
    setAppliedField(field);
    setTimeout(() => { if (isCurrent()) setAppliedField(null); }, 2000);
  };

  const copySchema = async () => {
    if (!suggestions?.schemaJsonLd) return;
    const isCurrent = beginOperation('copy');
    const isErrorCurrent = beginOperation('error');
    setCopiedJson(false);
    try {
      const copied = await copyText(JSON.stringify(suggestions.schemaJsonLd, null, 2));
      if (!isCurrent() || !copied) return;
      setCopiedJson(true);
      setTimeout(() => { if (isCurrent()) setCopiedJson(false); }, 2000);
    } catch (cause) {
      if (isCurrent() && isErrorCurrent()) setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return { copiedJson, appliedField, applyTitle: () => applyMetadata('title'), applyDescription: () => applyMetadata('desc'), copySchema };
}
