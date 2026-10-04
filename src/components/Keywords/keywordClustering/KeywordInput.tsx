import React from 'react';
import { Plus } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { ClusteringSession } from './keywordClusteringTypes';

interface KeywordInputProps {
  session: ClusteringSession;
  isRunning: boolean;
  currentResearch: Array<{ keyword: string }>;
  savedKeywords: Array<{ keyword: string }>;
  updateSession: (patch: Partial<ClusteringSession>) => void;
  appendKeywords: (values: string[]) => void;
  t: TFunction;
}

/** Phrase list shared by both clustering methods. */
export const KeywordInput: React.FC<KeywordInputProps> = ({ session, isRunning, currentResearch, savedKeywords, updateSession, appendKeywords, t }) => (
  <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="cluster-keywords" className="text-sm font-semibold text-slate-100">
          {t('keywordClusteringUi.keywordsLabel')}
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => appendKeywords(currentResearch.map((item) => item.keyword))}
            disabled={!currentResearch.length || isRunning}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-emerald-500/50 hover:text-white disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> {t('keywordClusteringUi.addFromResearch')}
          </button>
          <button
            type="button"
            onClick={() => appendKeywords(savedKeywords.map((item) => item.keyword))}
            disabled={!savedKeywords.length || isRunning}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-emerald-500/50 hover:text-white disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> {t('keywordClusteringUi.addSaved')}
          </button>
        </div>
      </div>
      <textarea
        id="cluster-keywords"
        value={session.input}
        onChange={(event) => updateSession({ input: event.target.value, result: null })}
        disabled={isRunning}
        rows={8}
        placeholder={t('keywordClusteringUi.placeholder')}
        className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500 disabled:opacity-70"
      />
  </>
);
