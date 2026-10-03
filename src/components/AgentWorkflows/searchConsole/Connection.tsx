import type { SearchConsoleSession } from './useSearchConsoleSession';
import { Globe, Loader2, ShieldCheck } from 'lucide-react';

export function SearchConsoleConnection({ session }: { session: SearchConsoleSession }) {
  const { t, isGscLoading, gscError, handleConnect, inputClientId, setInputClientId, inputClientSecret, setInputClientSecret } = session;
  return <>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-white font-bold text-base">
            <Globe className="w-5 h-5 text-emerald-400" />
            <span>{t('searchConsole.connectTitle')}</span>
          </div>
          <p className="text-xs text-slate-400">
            {t('searchConsole.connectDescription')}
          </p>

          <form onSubmit={handleConnect} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              value={inputClientId}
              onChange={(e) => setInputClientId(e.target.value)}
              placeholder={t('searchConsole.clientIdPlaceholder')}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <input
              type="password"
              value={inputClientSecret}
              onChange={(e) => setInputClientSecret(e.target.value)}
              placeholder={t('searchConsole.clientSecretPlaceholder')}
              aria-label={t('searchConsole.clientSecretLabel')}
              autoComplete="off"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              disabled={isGscLoading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-950"
            >
              {isGscLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('searchConsole.connecting')}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('searchConsole.authorize')}</span>
                </>
              )}
            </button>
          </form>
          {gscError && <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200">{gscError}</p>}
        </div>
  </>;
}
