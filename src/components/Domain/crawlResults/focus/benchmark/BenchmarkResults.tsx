import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { BenchmarkReport, CompetitorResult } from '@/services/siteFocusBenchmark';

const failureText = (item: CompetitorResult, t: (key: string, options?: Record<string, unknown>) => string): string =>
  t(`focusBenchmark.failure.${item.failure ?? 'crawl-error'}`, { error: item.error ?? '' });

export const BenchmarkResults = ({ report, onApplyTerms }: { report: BenchmarkReport; onApplyTerms?: (terms: string[]) => void }) => {
  const { t } = useTranslation();
  const failed = report.competitors.filter((item) => item.status === 'failed');
  return (
    <div className="space-y-4" data-testid="benchmark-results">
      <p className="text-xs text-slate-400">
        {t('focusBenchmark.sources', { source: report.serpSource })} · {t('focusBenchmark.queries', { queries: report.queries.join(', ') })} · {t('focusBenchmark.sample', { count: report.pagesPerCompetitor })}
      </p>
      <div className="flex flex-wrap gap-4 text-sm text-slate-200">
        <span>{t('focusBenchmark.ranking.position', { rank: report.ownRank, total: report.ranking.length })}</span>
        {report.industryAverage !== null && <span>{t('focusBenchmark.ranking.average')}: <strong>{report.industryAverage}</strong></span>}
        <span>{t('focusBenchmark.ranking.target')}: <strong>{report.targetScore}</strong> <HelpTip id="focus.benchmarkTarget" /></span>
      </div>
      <ol className="space-y-1" aria-label={t('focusBenchmark.ranking.chart')}>
        {report.ranking.map((row) => (
          <li key={row.domain} data-own={row.isOwn} className={`rounded-lg border px-3 py-2 ${row.isOwn ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/40'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
              <span className="font-medium">{row.rank}. {row.domain}{row.isOwn ? ` (${t('focusBenchmark.ranking.you')})` : ''}</span>
              <span className="text-slate-400">{t('focusBenchmark.ranking.pages', { count: row.pageCount })} · {t('focusBenchmark.ranking.onTopic', { pct: row.onTopicRatio })} · {t('focusBenchmark.ranking.offTopic', { count: row.offTopicPages })} · {t('focusBenchmark.ranking.score', { score: row.score })}</span>
            </div>
            <div className="mt-1 h-2 rounded bg-slate-800" role="img" aria-label={`${row.domain} ${row.score}`}>
              <div className={`h-2 rounded ${row.isOwn ? 'bg-emerald-400' : 'bg-sky-500'}`} style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }} />
            </div>
          </li>
        ))}
      </ol>
      {failed.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-200" aria-label={t('focusBenchmark.failure.title')}>
          {failed.map((item) => <li key={item.domain}>{item.domain}: {failureText(item, t)}</li>)}
        </ul>
      )}
      {report.insights.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-slate-100">{t('focusBenchmark.insights.title')}</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-300">
            {report.insights.map((insight) => <li key={insight.code}>{t(`focusBenchmark.insights.${insight.code}`, insight.params)}</li>)}
          </ul>
        </section>
      )}
      <section>
        <h4 className="text-sm font-semibold text-slate-100">{t('focusBenchmark.gaps.title')}</h4>
        {report.gaps.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">{t('focusBenchmark.gaps.empty')}</p>
        ) : (
          <>
            <ul className="mt-1 grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
              {report.gaps.map((gap) => <li key={gap.term}>{gap.term}: {t('focusBenchmark.gaps.coverage', { pct: gap.coveragePct, count: gap.competitors })}</li>)}
            </ul>
            {onApplyTerms && report.competitorTerms.length > 0 && (
              <button type="button" onClick={() => onApplyTerms(report.competitorTerms)} className="mt-2 rounded-lg border border-emerald-500/40 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10">
                {t('focusBenchmark.gaps.apply')}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
};
