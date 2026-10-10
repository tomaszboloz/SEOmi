import React from 'react';
import type { TFunction } from 'i18next';
import type { AiPromptComparison, CrawlRunRecord } from '@/types';
import { appLocale } from '@/services/localeFormat';

const completionLabel = (value: string): string => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(appLocale()) : '—';
};

interface AiSearchHistoryAndContextProps {
  comparison: AiPromptComparison | null;
  history: AiPromptComparison[];
  onSelectHistory: (capturedAt: string) => void;
  crawlRuns: CrawlRunRecord[];
  sourceContextRunId: string;
  sourceContextRun: CrawlRunRecord | null;
  sourceContextSaveError: boolean;
  onSelectSourceContextRun: (runId: string) => void;
  t: TFunction;
}

export const AiSearchHistoryAndContext: React.FC<AiSearchHistoryAndContextProps> = ({
  comparison,
  history,
  onSelectHistory,
  crawlRuns,
  sourceContextRunId,
  sourceContextRun,
  sourceContextSaveError,
  onSelectSourceContextRun,
  t,
}) => {
  if (!comparison) return null;

  return (
    <div className="space-y-4">
      {history.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <label htmlFor="ai-prompt-history" className="text-xs text-slate-300">
            {t('aiVisibility.search.historyLabel')}
          </label>
          <select
            id="ai-prompt-history"
            aria-label={t('aiVisibility.search.historyAria')}
            value={comparison.captured_at}
            onChange={(event) => onSelectHistory(event.target.value)}
            className="min-w-64 max-w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
          >
            {history.map((item) => (
              <option key={item.captured_at} value={item.captured_at}>
                {new Date(item.captured_at).toLocaleString(appLocale())} · {item.prompt}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-slate-500">
            {t('aiVisibility.search.historyNote')}
          </span>
        </div>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              {t('aiVisibility.search.sourceTitle')}
            </h3>
            <p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-500">
              {t('aiVisibility.search.sourceDescription')}
            </p>
          </div>
          <label className="min-w-64 text-[10px] text-slate-400">
            {t('aiVisibility.search.sourceLabel')}
            <select
              aria-label={t('aiVisibility.search.sourceAria')}
              value={sourceContextRunId}
              onChange={(event) => onSelectSourceContextRun(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-100"
            >
              <option value="">{t('aiVisibility.search.noSnapshot')}</option>
              {crawlRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {completionLabel(run.completedAt)} · {run.startUrl} ·{' '}
                  {t('crawl.ui.urlsCount', { count: run.result.pages_crawled })}
                </option>
              ))}
            </select>
          </label>
        </div>
        {sourceContextSaveError && (
          <p role="alert" className="mt-2 text-[10px] text-amber-200">
            {t('aiVisibility.search.sourceSaveError')}
          </p>
        )}
        {sourceContextRun && (
          <p className="mt-2 text-[10px] text-slate-500">
            {t('aiVisibility.search.evidenceRun', {
              id: sourceContextRun.id,
              date: completionLabel(sourceContextRun.completedAt),
              count: sourceContextRun.result.pages.length,
            })}
          </p>
        )}
      </section>
    </div>
  );
};
