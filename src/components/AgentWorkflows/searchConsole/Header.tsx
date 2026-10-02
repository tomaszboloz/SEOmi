import type { SearchConsoleSession } from './useSearchConsoleSession';
import { RefreshCw } from 'lucide-react';

export function SearchConsoleHeader({ session }: { session: SearchConsoleSession }) {
  const { t, isGscConnected, gscProperty, isGscLoading, disconnectGsc, dateRangeError, handleRefresh } = session;
  return <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {t('searchConsole.badge')}
            </span>
            <span className="text-xs text-slate-400 font-mono">{t('searchConsole.dataBadge')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">{t('searchConsole.title')}</h1>
          <p className="text-sm text-slate-400">
            {t('searchConsole.description')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isGscConnected ? (
            <>
              <button
                onClick={handleRefresh}
                disabled={isGscLoading || !gscProperty || Boolean(dateRangeError)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isGscLoading ? 'animate-spin' : ''}`} />
                <span>{t('searchConsole.refresh')}</span>
              </button>
              <button
                onClick={() => void disconnectGsc()}
                disabled={isGscLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 transition disabled:opacity-50"
              >
                {t('searchConsole.disconnect')}
              </button>
            </>
          ) : null}
        </div>
      </div>
  </>;
}
