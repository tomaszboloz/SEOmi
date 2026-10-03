import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { matchAiCitationToCrawl } from '@/services/aiCitationEvidence';
import { readStorage, removeStorage, writeStorage } from '@/services/storage';
import { copyText } from '@/services/clipboard';
import type { CitationSummary } from './searchPromptsTypes';

export const useAiSearchPromptsSession = () => {
  const { t } = useTranslation();
  const projectId = useProjectStore((s) => s.activeProjectId);
  const aiSearchPrompt = useToolsStore((s) => s.aiSearchPrompt);
  const aiPromptComparison = useToolsStore((s) => s.aiPromptComparison);
  const aiPromptHistory = useToolsStore((s) => s.aiPromptHistory);
  const isLoading = useToolsStore((s) => s.isAiPromptLoading);
  const error = useToolsStore((s) => s.aiPromptError);
  const setAiSearchPrompt = useToolsStore((s) => s.setAiSearchPrompt);
  const runAiPromptComparison = useToolsStore((s) => s.runAiPromptComparison);
  const selectAiPromptComparison = useToolsStore((s) => s.selectAiPromptComparison);
  const crawlRuns = useToolsStore((s) => s.crawlRuns);
  const selectedCrawlRunId = useToolsStore((s) => s.selectedCrawlRunId);

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [sourceContextRunId, setSourceContextRunId] = useState('');
  const [sourceContextSaveError, setSourceContextSaveError] = useState(false);
  const sourceContextKey = projectId ? `seomi_project_${projectId}_ai_citation_crawl_context_v1` : '';
  const sourceContextRun = crawlRuns.find((run) => run.id === sourceContextRunId) ?? null;

  useEffect(() => {
    if (!projectId || !sourceContextKey) {
      setSourceContextRunId('');
      return;
    }
    const saved = readStorage(sourceContextKey);
    const available = saved && crawlRuns.some((run) => run.id === saved) ? saved : '';
    setSourceContextRunId(
      available ||
        (crawlRuns.some((run) => run.id === selectedCrawlRunId)
          ? selectedCrawlRunId || ''
          : crawlRuns[0]?.id || ''),
    );
    setSourceContextSaveError(false);
  }, [projectId, sourceContextKey, crawlRuns, selectedCrawlRunId]);

  const selectSourceContextRun = (runId: string) => {
    setSourceContextRunId(runId);
    if (!sourceContextKey) return;
    const saved = runId ? writeStorage(sourceContextKey, runId) : removeStorage(sourceContextKey);
    setSourceContextSaveError(!saved);
  };

  const citationsWithEvidence = useMemo(
    () =>
      (aiPromptComparison?.results ?? []).map((result) =>
        result.citations.map((citation) =>
          matchAiCitationToCrawl(citation, sourceContextRun, result.response_text),
        ),
      ),
    [aiPromptComparison, sourceContextRun],
  );

  const citationSummaries: CitationSummary[] = useMemo(
    () =>
      (aiPromptComparison?.results ?? []).map((result, resultIndex) => {
        const evidence = citationsWithEvidence[resultIndex] ?? [];
        return {
          total: result.citations.length,
          matched: evidence.filter((item) => item.matched).length,
          contextual: evidence.filter((item) => item.context?.meetsMinimum).length,
          sentenceMatches: evidence.filter((item) => item.context?.sentenceMatch).length,
        };
      }),
    [aiPromptComparison, citationsWithEvidence],
  );

  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiSearchPrompt.trim()) return;
    setAiSearchPrompt(aiSearchPrompt.trim());
    runAiPromptComparison(aiSearchPrompt.trim());
  };

  const samplePrompts = t('aiVisibility.samplePrompts', { returnObjects: true }) as string[];

  const handleCopy = async (text: string, idx: number) => {
    const copied = await copyText(text);
    if (!copied) return;
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return {
    aiSearchPrompt,
    setAiSearchPrompt,
    aiPromptComparison,
    aiPromptHistory,
    isLoading,
    error,
    runAiPromptComparison,
    selectAiPromptComparison,
    crawlRuns,
    sourceContextRunId,
    selectSourceContextRun,
    sourceContextSaveError,
    sourceContextRun,
    citationsWithEvidence,
    citationSummaries,
    copiedIdx,
    handleCopy,
    handleCompare,
    samplePrompts,
    t,
  };
};
