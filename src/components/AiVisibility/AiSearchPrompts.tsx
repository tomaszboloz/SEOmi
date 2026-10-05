import React from 'react';
import { useAiSearchPromptsSession } from './searchPrompts/useAiSearchPromptsSession';
import { AiSearchPromptsHeader } from './searchPrompts/AiSearchPromptsHeader';
import { AiSearchPromptForm } from './searchPrompts/AiSearchPromptForm';
import { AiSearchHistoryAndContext } from './searchPrompts/AiSearchHistoryAndContext';
import { AiSearchResultCard } from './searchPrompts/AiSearchResultCard';
import { appLocale } from '@/services/localeFormat';

export const AiSearchPrompts: React.FC = () => {
  const {
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
  } = useAiSearchPromptsSession();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <AiSearchPromptsHeader t={t} />

      <AiSearchPromptForm
        prompt={aiSearchPrompt}
        isLoading={isLoading}
        samplePrompts={samplePrompts}
        onChangePrompt={setAiSearchPrompt}
        onSubmit={handleCompare}
        onSelectSample={(sample) => {
          setAiSearchPrompt(sample);
          runAiPromptComparison(sample);
        }}
        t={t}
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm">
          {error}
        </div>
      )}

      <AiSearchHistoryAndContext
        comparison={aiPromptComparison}
        history={aiPromptHistory}
        onSelectHistory={selectAiPromptComparison}
        crawlRuns={crawlRuns}
        sourceContextRunId={sourceContextRunId}
        sourceContextRun={sourceContextRun}
        sourceContextSaveError={sourceContextSaveError}
        onSelectSourceContextRun={selectSourceContextRun}
        t={t}
      />

      {aiPromptComparison && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">
                {t('aiVisibility.search.localResponses')}
              </h3>
              <p className="mt-1 text-[10px] text-slate-500">
                {t('aiVisibility.search.promptStarted', {
                  date: new Date(aiPromptComparison.captured_at).toLocaleString(appLocale()),
                })}
              </p>
            </div>
            <span className="max-w-xl text-xs text-slate-400">
              {t('aiVisibility.search.promptPrefix', { prompt: aiPromptComparison.prompt })}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {aiPromptComparison.results.map((res, idx) => (
              <AiSearchResultCard
                key={idx}
                result={res}
                idx={idx}
                copiedIdx={copiedIdx}
                onCopy={handleCopy}
                summary={citationSummaries[idx]}
                evidenceList={citationsWithEvidence[idx] ?? []}
                sourceContextRun={sourceContextRun}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
