import React from 'react';
import { Link2, Search, Loader2 } from 'lucide-react';
import type { BacklinkSession } from './useBacklinkSession';

export const BacklinkHeader: React.FC<{ session: BacklinkSession }> = ({
  session,
}) => {
  const { t, inputTarget, setInputTarget, isLoading, handleAnalyze } = session;

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {t('domainResearchUi.badge')}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {t('backlinkUi.eyebrow')}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            {t('backlinkUi.title')}
          </h1>
          <p className="text-sm text-slate-400">
            {t('backlinkUi.description')}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleAnalyze}
        className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row gap-3 shadow-lg"
      >
        <div className="flex-1 relative">
          <Link2 className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={inputTarget}
            onChange={(e) => setInputTarget(e.target.value)}
            placeholder={t('backlinkUi.placeholder')}
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-950"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('backlinkUi.scanning')}</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span>{t('backlinkUi.inspect')}</span>
            </>
          )}
        </button>
      </form>

      <p className="-mt-5 text-[11px] text-slate-500">
        {t('backlinkUi.costSummary')}
      </p>
    </>
  );
};
