import type { SearchConsoleSession } from './useSearchConsoleSession';
import { FileCheck } from 'lucide-react';

export function SearchConsoleInspection({ session }: { session: SearchConsoleSession }) {
  const { t, gscProperty, gscInspectionResult, isGscLoading, gscError, handleInspect, inspectUrl, setInspectUrl } = session;
  return <>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>{t('searchConsole.urlInspectionTitle')}</span>
            </h3>

            <form onSubmit={handleInspect} className="flex gap-2">
              <input
                type="text"
                value={inspectUrl}
                onChange={(e) => setInspectUrl(e.target.value)}
                aria-label={t('searchConsole.inspectionAria')}
                placeholder={t('searchConsole.inspectionPlaceholder')}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                disabled={isGscLoading || !gscProperty}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition"
              >
                {t('searchConsole.inspectUrl')}
              </button>
            </form>

            {gscInspectionResult && <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] text-emerald-200">{JSON.stringify(gscInspectionResult, null, 2)}</pre>}
            {gscError && <p role="alert" className="text-xs text-rose-300">{gscError}</p>}
          </div>
  </>;
}
