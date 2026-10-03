import type { SearchConsoleSession } from './useSearchConsoleSession';
import { appLocale } from '@/services/localeFormat';

export function SearchConsoleTables({ session }: { session: SearchConsoleSession }) {
  const { t, gscData } = session;
  return <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Queries */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h3 className="font-bold text-white text-sm">{t('searchConsole.topQueries')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="text-slate-500 uppercase border-b border-slate-800 font-sans">
                    <tr>
                      <th className="pb-2">{t('searchConsole.searchQuery')}</th>
                      <th className="pb-2 text-right">{t('searchConsole.clicksShort')}</th>
                      <th className="pb-2 text-right">{t('searchConsole.impressionsShort')}</th>
                      <th className="pb-2 text-right">{t('searchConsole.ctr')}</th>
                      <th className="pb-2 text-center">{t('searchConsole.positionShortHeader')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {gscData?.queries.map((q, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 font-sans font-medium text-slate-200">{q.query}</td>
                        <td className="py-2.5 text-right text-emerald-400 font-bold">{q.clicks.toLocaleString(appLocale())}</td>
                        <td className="py-2.5 text-right text-slate-400">{q.impressions.toLocaleString(appLocale())}</td>
                        <td className="py-2.5 text-right text-slate-300">{q.ctr}%</td>
                        <td className="py-2.5 text-center text-amber-400 font-bold">#{q.position}</td>
                      </tr>
                    ))}
                    {gscData?.queries.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">{t('searchConsole.noQueryRows')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Pages */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h3 className="font-bold text-white text-sm">{t('searchConsole.topPages')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="text-slate-500 uppercase border-b border-slate-800 font-sans">
                    <tr>
                      <th className="pb-2">{t('searchConsole.pageUrl')}</th>
                      <th className="pb-2 text-right">{t('searchConsole.clicksShort')}</th>
                      <th className="pb-2 text-right">{t('searchConsole.impressionsShort')}</th>
                      <th className="pb-2 text-right">{t('searchConsole.ctr')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {gscData?.pages.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 text-slate-200 truncate max-w-[180px]">{p.page}</td>
                        <td className="py-2.5 text-right text-emerald-400 font-bold">{p.clicks.toLocaleString(appLocale())}</td>
                        <td className="py-2.5 text-right text-slate-400">{p.impressions.toLocaleString(appLocale())}</td>
                        <td className="py-2.5 text-right text-slate-300">{p.ctr}%</td>
                      </tr>
                    ))}
                    {gscData?.pages.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-slate-500">{t('searchConsole.noPageRows')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
  </>;
}
