import { useMemo } from 'react';
import { AlertCircle, CircleHelp, CircleCheck, ShieldAlert } from 'lucide-react';
import type { SiteCrawlResult } from '@/types';
import { buildCrawlerReadiness, type CrawlerReadinessStatus } from '@/services/crawlerReadiness';
import { useTranslation } from 'react-i18next';

interface CrawlerReadinessPanelProps {
  result: SiteCrawlResult;
}

const statusMeta: Record<CrawlerReadinessStatus, { key: string; className: string; icon: typeof CircleCheck }> = {
  pass: { key: 'pass', className: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-200', icon: CircleCheck },
  warning: { key: 'warning', className: 'border-amber-500/25 bg-amber-500/5 text-amber-100', icon: ShieldAlert },
  error: { key: 'error', className: 'border-rose-500/25 bg-rose-500/5 text-rose-100', icon: AlertCircle },
  unknown: { key: 'unknown', className: 'border-slate-700 bg-slate-950/50 text-slate-300', icon: CircleHelp },
};

export const CrawlerReadinessPanel = ({ result }: CrawlerReadinessPanelProps) => {
  const { t } = useTranslation();
  const report = useMemo(() => buildCrawlerReadiness(result), [result]);

  return (
    <section className="space-y-4" aria-labelledby="crawler-readiness-heading">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/35 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">{t('crawlerReadiness.eyebrow')}</p>
          <h3 id="crawler-readiness-heading" className="mt-1 text-base font-semibold text-slate-100">{t('crawlerReadiness.title')}</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{t('crawlerReadiness.description')}</p>
        </div>
        <div className="shrink-0 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('crawlerReadiness.scoreLabel')}</p>
          <p className="mt-0.5 text-2xl font-semibold text-white">{report.score === null ? '—' : `${report.score}/100`}</p>
          <p className="text-[10px] text-slate-500">{t('crawlerReadiness.scoreMeta', { known: report.knownChecks, total: report.checks.length, pages: report.totalPages })}</p>
        </div>
      </div>

      {result.robots_txt_warning && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{result.robots_txt_warning}</span>
        </div>
      )}

      {report.checks.length === 0 ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-6 text-center text-sm text-amber-100">{t('crawlerReadiness.emptyRun')}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {report.checks.map((check) => {
            const meta = statusMeta[check.status];
            const Icon = meta.icon;
            return (
              <article key={check.id} className={`rounded-lg border p-3 ${meta.className}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold">{t(`crawlerReadiness.checks.${check.labelKey}`)}</h4>
                      <p className="mt-1 text-[11px] leading-5 opacity-90">{t(`crawlerReadiness.checks.${check.evidenceKey}`, check.evidenceParams)}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-medium">{t(`crawlerReadiness.status.${meta.key}`)}</span>
                </div>
                {check.recommendationKey && <p className="mt-2 border-t border-current/10 pt-2 text-[10px] leading-4 opacity-80">{t('crawlerReadiness.nextStep', { recommendation: t(`crawlerReadiness.checks.${check.recommendationKey}`) })}</p>}
              </article>
            );
          })}
        </div>
      )}

      <details className="rounded-lg border border-slate-800 bg-slate-950/35">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-300">{t('crawlerReadiness.limitationsTitle')}</summary>
        <ul className="space-y-1 px-4 pb-3 pt-1 text-[11px] leading-5 text-slate-500">
          {report.limitationKeys.map((limitation) => <li key={limitation}>• {t(`crawlerReadiness.limitations.${limitation}`)}</li>)}
        </ul>
      </details>
    </section>
  );
};
