import React from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import type { TFunction } from 'i18next';
import { type ClusteringSession, MAX_KEYWORDS } from './keywordClusteringTypes';
import { KeywordClusteringPickers } from './KeywordClusteringPickers';
import { KeywordInput } from './KeywordInput';

interface KeywordClusteringFormProps {
  session: ClusteringSession;
  keywords: string[];
  credentials: { login?: string; password?: string };
  currentResearch: Array<{ keyword: string }>;
  savedKeywords: Array<{ keyword: string }>;
  isRunning: boolean;
  progress: number;
  error: string | null;
  updateSession: (patch: Partial<ClusteringSession>) => void;
  appendKeywords: (values: string[]) => void;
  changeCountry: (country: string) => void;
  runClustering: () => void;
  t: TFunction;
}

export const KeywordClusteringForm: React.FC<KeywordClusteringFormProps> = ({
  session,
  keywords,
  credentials,
  currentResearch,
  savedKeywords,
  isRunning,
  progress,
  error,
  updateSession,
  appendKeywords,
  changeCountry,
  runClustering,
  t,
}) => {
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <KeywordInput session={session} isRunning={isRunning} currentResearch={currentResearch} savedKeywords={savedKeywords} updateSession={updateSession} appendKeywords={appendKeywords} t={t} />
      <p className="text-xs text-amber-200">
        {t('dataforseo.paidRequests', {
          count: keywords.filter((keyword) => !session.result?.snapshots.some((item) => item.keyword === keyword)).length,
        })}
      </p>

      <KeywordClusteringPickers
        session={session}
        keywordsCount={keywords.length}
        isRunning={isRunning}
        changeCountry={changeCountry}
        updateSession={updateSession}
        t={t}
      />

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200/90">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p>{t('keywordClusteringUi.costNotice')}</p>
      </div>
      {error && (
        <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void runClustering()}
          disabled={isRunning || keywords.length < 2 || keywords.length > MAX_KEYWORDS}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isRunning
            ? t('keywordClusteringUi.fetching', { current: progress, total: keywords.length })
            : t('keywordClusteringUi.run')}
        </button>
        {!credentials.login || !credentials.password ? (
          <span className="text-xs text-amber-300">{t('keywordClusteringUi.credentialsHint')}</span>
        ) : null}
      </div>
    </section>
  );
};
