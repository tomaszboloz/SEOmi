import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { SiteFocusReport } from '@/services/siteFocus';
import { BenchmarkResults } from './BenchmarkResults';
import { defaultRunner, useFocusBenchmark, type BenchmarkRunner } from './useFocusBenchmark';

export interface FocusBenchmarkSectionProps {
  report: SiteFocusReport;
  /** Defaults to the origin of the first analyzed page. */
  startUrl?: string;
  /** Receives competitor terms to feed into the Topic Cluster Gap Analysis. */
  onCompetitorTerms?: (terms: string[]) => void;
  /** Injectable for tests. */
  runner?: BenchmarkRunner;
}

const originOf = (report: SiteFocusReport): string => {
  try {
    return new URL(report.pages[0]?.url ?? '').origin + '/';
  } catch {
    return '';
  }
};

export const FocusBenchmarkSection = ({ report, startUrl, onCompetitorTerms, runner = defaultRunner }: FocusBenchmarkSectionProps) => {
  const { t } = useTranslation();
  const { state, start, cancel } = useFocusBenchmark(runner);
  const { running, progress, outcome, error } = state;
  const run = () => void start({ report, startUrl: startUrl ?? originOf(report) });
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4" aria-labelledby="focus-benchmark-title">
      <header className="flex items-center justify-between gap-3">
        <h3 id="focus-benchmark-title" className="text-sm font-semibold text-slate-100">{t('focusBenchmark.title')} <HelpTip id="focus.benchmark" /></h3>
        {running ? (
          <button type="button" onClick={cancel} className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200">{t('focusBenchmark.cancel')}</button>
        ) : (
          <button type="button" onClick={run} className="rounded-lg border border-emerald-500/40 px-3 py-1 text-xs text-emerald-200">{outcome || error ? t('focusBenchmark.rerun') : t('focusBenchmark.run')}</button>
        )}
      </header>
      {!running && !outcome && !error && <p className="text-xs text-slate-400">{t('focusBenchmark.intro')}</p>}
      {running && (
        <div role="status" className="text-xs text-slate-300">
          {progress ? t(`focusBenchmark.progress.${progress.phase}`, { done: progress.done, total: progress.total, domain: progress.phase === 'crawl' ? progress.domain : '', pages: progress.phase === 'crawl' ? progress.pages : 0 }) : t('focusBenchmark.progress.serp', { done: 0, total: 0 })}
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-300">{t('focusBenchmark.error', { error })}</p>}
      {outcome?.status === 'cancelled' && <p className="text-xs text-slate-400">{t('focusBenchmark.cancelled')}</p>}
      {outcome?.status === 'unavailable' && (
        <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100">
          <strong>{t('focusBenchmark.unavailable.title')}</strong>
          <p>{t(`focusBenchmark.unavailable.${outcome.reason}`, { error: outcome.error ?? '' })}</p>
        </div>
      )}
      {outcome?.status === 'ok' && <BenchmarkResults report={outcome.report} onApplyTerms={onCompetitorTerms} />}
    </section>
  );
};
