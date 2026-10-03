import React from 'react';
import { Search, Loader2 } from 'lucide-react';
import { BacklinkGapTable } from './BacklinkGapTable';
import type { BacklinkSession } from './useBacklinkSession';

export const BacklinkGapSection: React.FC<{ session: BacklinkSession }> = ({
  session,
}) => {
  const {
    t,
    inputTarget,
    competitorInput,
    setCompetitorInput,
    parsedCompetitors,
    backlinkGapIncludeSubdomains,
    setBacklinkGapIncludeSubdomains,
    backlinkGapReport,
    isBacklinkGapLoading,
    backlinkGapError,
    setBacklinkGapCompetitors,
    handleAnalyzeGap,
    loadMoreBacklinkGap,
  } = session;

  return (
    <section
      className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5"
      aria-labelledby="backlink-gap-title"
    >
      <div>
        <h2 id="backlink-gap-title" className="text-base font-semibold text-white">
          {t('backlinkUi.gapTitle')}
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {t('backlinkUi.gapDescription')}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <label className="space-y-1.5 text-xs text-slate-300">
          <span>{t('backlinkUi.competitorLabel')}</span>
          <textarea
            aria-label={t('backlinkUi.competitorAria')}
            value={competitorInput}
            onChange={(event) => {
              const next = event.target.value;
              setCompetitorInput(next);
              setBacklinkGapCompetitors(
                next
                  .split(/[\n,;]+/)
                  .map((domain) => domain.trim())
                  .filter(Boolean)
                  .slice(0, 19),
              );
            }}
            placeholder={t('backlinkUi.competitorPlaceholder')}
            rows={3}
            className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <div className="flex flex-col items-start justify-end gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={backlinkGapIncludeSubdomains}
              onChange={(event) =>
                setBacklinkGapIncludeSubdomains(event.target.checked)
              }
              className="accent-emerald-500"
            />
            {t('backlinkUi.includeSubdomains')}
          </label>
          <button
            type="button"
            onClick={handleAnalyzeGap}
            disabled={
              isBacklinkGapLoading ||
              !inputTarget.trim() ||
              parsedCompetitors.length === 0
            }
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBacklinkGapLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {t('backlinkUi.analyzeGap')}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-amber-300/80">{t('backlinkUi.gapNotice')}</p>

      {backlinkGapError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-300"
        >
          {backlinkGapError}
        </div>
      )}

      {backlinkGapReport && (
        <BacklinkGapTable
          report={backlinkGapReport}
          isLoading={isBacklinkGapLoading}
          loadMore={() => void loadMoreBacklinkGap()}
          t={t}
        />
      )}
    </section>
  );
};
