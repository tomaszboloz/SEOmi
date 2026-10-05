import React from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { DomainComparisonTable } from './DomainComparisonTable';
import { DomainComparisonHistory } from './DomainComparisonHistory';
import type { DomainOverviewSession } from './useDomainOverviewSession';
import { appLocale } from '@/services/localeFormat';

export const DomainComparisonSection: React.FC<{
  session: DomainOverviewSession;
}> = ({ session }) => {
  const {
    t,
    inputDomain,
    comparisonInput,
    setComparisonInput,
    domainOverview,
    domainComparison,
    domainComparisonHistory,
    isDomainComparisonLoading,
    domainComparisonError,
    setDomainComparisonTargets,
    handleCompareDomains,
  } = session;

  const competitorCount = comparisonInput
    .split(/[\n,;]+/)
    .filter((v) => v.trim()).length;
  const paidRequestCount = 5 * Math.min(5, 1 + competitorCount);

  return (
    <section
      className="rounded-xl border border-violet-500/20 bg-slate-900/60 p-5 space-y-4"
      aria-label={t('domainResearchUi.compareDomains')}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-300" />
            {t('domainResearchUi.compareDomains')}
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            {t('domainResearchUi.compareDescription')}
          </p>
        </div>
        {domainComparison && (
          <span className="shrink-0 text-[11px] text-slate-500">
            {t('domainResearchUi.domainCount', {
              count: domainComparison.rows.length,
              date: new Date(domainComparison.retrieved_at).toLocaleString(appLocale()),
            })}
          </span>
        )}
      </div>

      <p className="text-xs text-amber-200">
        {t('dataforseo.paidRequests', { count: paidRequestCount })}
      </p>

      <form
        onSubmit={handleCompareDomains}
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <label className="text-xs text-slate-400">
          {t('domainResearchUi.competitorInputLabel')}
          <textarea
            aria-label={t('domainResearchUi.competitorInputAria')}
            value={comparisonInput}
            onChange={(event) => {
              const next = event.target.value;
              setComparisonInput(next);
              const competitors = next
                .split(/[\n,;]+/)
                .map((v) => v.trim())
                .filter(Boolean);
              const target = domainOverview?.domain || inputDomain;
              setDomainComparisonTargets([target, ...competitors]);
            }}
            rows={2}
            placeholder={t('domainResearchUi.competitorPlaceholder')}
            className="mt-1.5 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-violet-400"
          />
        </label>
        <button
          type="submit"
          disabled={isDomainComparisonLoading || !inputDomain.trim()}
          className="inline-flex h-9 items-center justify-center gap-1.5 self-end rounded-md bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-wait disabled:opacity-50"
        >
          {isDomainComparisonLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <BarChart3 className="h-3.5 w-3.5" />
          )}
          {t('domainResearchUi.compareLive')}
        </button>
      </form>

      {domainComparisonError && (
        <p
          role="alert"
          className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100"
        >
          {domainComparisonError}
        </p>
      )}

      {domainComparison && (
        <DomainComparisonTable comparison={domainComparison} t={t} />
      )}

      {domainComparison && (
        <DomainComparisonHistory
          comparison={domainComparison}
          history={domainComparisonHistory}
          t={t}
        />
      )}
    </section>
  );
};
