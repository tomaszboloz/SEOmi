import type { SearchConsoleSession } from './useSearchConsoleSession';
import { TrendChart } from '@/components/Charts/TrendChart';
import { MousePointerClick, Eye, Percent, TrendingUp } from 'lucide-react';

export function SearchConsoleMetrics({ session }: { session: SearchConsoleSession }) {
  const { t, gscData } = session;
  return <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <MousePointerClick className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('searchConsole.totalClicks')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {gscData?.total_clicks.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-500">{gscData ? `${gscData.start_date} — ${gscData.end_date}` : t('searchConsole.completeDays')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('searchConsole.totalImpressions')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {gscData?.total_impressions.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-500">{t('searchConsole.searchAppearances')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('searchConsole.averageCtr')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">{gscData?.avg_ctr}%</div>
              <span className="text-[11px] text-slate-500">{t('searchConsole.clickThroughRate')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                <span>{t('searchConsole.averagePosition')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">{gscData?.avg_position}</div>
              <span className="text-[11px] text-slate-500">{t('searchConsole.meanSerpRank')}</span>
            </div>
          </div>
          {gscData && <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div><h2 className="font-semibold text-white">{t('searchConsole.dailyTrend')}</h2><p className="text-xs text-slate-400">{t('searchConsole.dailyTrendDescription')}</p>{gscData.daily_may_be_truncated && <p role="note" className="mt-1 text-xs text-amber-300">{t('searchConsole.trendTruncated')}</p>}</div>
            {gscData.daily.length >= 2 ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {([
                { key: 'clicks', title: t('searchConsole.clicks'), invert: false },
                { key: 'impressions', title: t('searchConsole.impressions'), invert: false },
                { key: 'ctr', title: t('searchConsole.ctr'), invert: false },
                { key: 'position', title: t('searchConsole.position'), invert: true },
              ] as const).map(({ key, title, invert }) => <div key={key} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs text-slate-300">{title}</span><span className="text-[10px] text-slate-500">{t('searchConsole.days', { count: gscData.daily.length })}</span></div>
                <TrendChart values={gscData.daily.map((day) => day[key])} label={t('searchConsole.dailyTrendLabel', { metric: title })} invert={invert} />
                <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{gscData.daily[0]?.date}</span><span>{gscData.daily.at(-1)?.date}</span></div>
              </div>)}
            </div> : <p className="text-xs text-slate-500">{t('searchConsole.tooFewPoints')}</p>}
          </section>}
          {gscData && <p role="note" className={`rounded-lg border p-3 text-[11px] leading-5 ${gscData.queries_may_be_truncated || gscData.pages_may_be_truncated ? 'border-amber-500/30 bg-amber-950/20 text-amber-200' : 'border-slate-800 bg-slate-900/40 text-slate-400'}`}>
            {t('searchConsole.analyticsPaging', { max: gscData.max_rows_per_dimension.toLocaleString(), queries: gscData.queries.length.toLocaleString(), pages: gscData.pages.length.toLocaleString(), truncated: gscData.queries_may_be_truncated || gscData.pages_may_be_truncated ? t('searchConsole.analyticsTruncated') : '' })}
          </p>}
  </>;
}
