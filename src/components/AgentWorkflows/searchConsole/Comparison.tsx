import type { SearchConsoleSession } from './useSearchConsoleSession';
import { SearchConsoleUnmatchedRows } from './UnmatchedRows';

export function SearchConsoleComparison({ session }: { session: SearchConsoleSession }) {
  const { t, gscData, currentSnapshot, comparison, strikingDistance, snapshotScopeLabel, snapshots, baselineId, setBaselineId } = session;
  return <>
          {gscData && <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold text-white">{t('searchConsole.changesTitle')}</h2><p className="text-xs text-slate-400">{t('searchConsole.changesDescription')}</p></div>
              <label className="flex items-center gap-2 text-xs text-slate-300">{t('searchConsole.baselinePeriod')}
                <select aria-label={t('searchConsole.baselineSnapshotAria')} value={baselineId} onChange={(event) => setBaselineId(event.target.value)} className="max-w-64 rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-slate-100">
                  <option value="">{t('searchConsole.chooseSnapshot')}</option>
                  {snapshots.filter((snapshot) => snapshot.id !== currentSnapshot?.id).map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.start_date} — {snapshot.end_date}{snapshotScopeLabel(snapshot.filters)}</option>)}
                </select>
              </label>
            </div>
            {comparison?.compatible ? <>
              <p className={`text-xs ${comparison.uncertainBecauseTruncated ? 'text-amber-300' : 'text-slate-400'}`}>
                {t('searchConsole.comparedRows', { queries: comparison.queryChanges.length, pages: comparison.pageChanges.length })}
              </p>
              {comparison.uncertainBecauseTruncated && <p role="note" className="text-xs text-amber-300">{t('searchConsole.truncatedWarning')}</p>}
              <SearchConsoleUnmatchedRows rows={comparison.unmatchedRows} />
              <div className="grid gap-4 lg:grid-cols-2">
                <div><h3 className="mb-2 text-sm font-medium text-white">{t('searchConsole.queryDeclines')}</h3>
                  {comparison.queryChanges.filter((change) => change.potentialDecline).slice(0, 10).map((change) => <div key={change.key} className="flex justify-between gap-3 border-t border-slate-800 py-2 text-xs"><span className="truncate text-slate-200">{change.key}</span><span className="shrink-0 text-rose-300">{change.clicksDeltaPercent === null ? '—' : `${change.clicksDeltaPercent.toFixed(1)}% ${t('searchConsole.clicksDelta')}`}</span></div>)}
                  {!comparison.queryChanges.some((change) => change.potentialDecline) && <p className="text-xs text-slate-500">{t('searchConsole.noDeclines')}</p>}
                </div>
                <div><h3 className="mb-2 text-sm font-medium text-white">{t('searchConsole.strikingDistance')}</h3>
                  {strikingDistance.slice(0, 10).map((query) => <div key={query.query} className="flex justify-between gap-3 border-t border-slate-800 py-2 text-xs"><span className="truncate text-slate-200">{query.query}</span><span className="shrink-0 text-emerald-300">{t('searchConsole.positionShort', { position: query.position.toFixed(1), impressions: query.impressions.toLocaleString() })}</span></div>)}
                  {!strikingDistance.length && <p className="text-xs text-slate-500">{t('searchConsole.noStrikingDistance')}</p>}
                </div>
              </div>
            </> : <p className="text-xs text-slate-500">{comparison?.reason || t('searchConsole.comparisonUnavailable')}</p>}
          </section>}
  </>;
}
