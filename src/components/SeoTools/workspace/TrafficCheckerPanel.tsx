import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Search } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { appLocale } from '@/services/localeFormat';

export const TrafficCheckerPanel: React.FC = () => {
  const { t } = useTranslation();
  const project = useProjectStore((state) =>
    state.projects.find((item) => item.id === state.activeProjectId),
  );
  const domainQuery = useToolsStore((state) => state.domainQuery);
  const domainOverview = useToolsStore((state) => state.domainOverview);
  const isLoading = useToolsStore((state) => state.isDomainLoading);
  const error = useToolsStore((state) => state.domainError);
  const setDomainQuery = useToolsStore((state) => state.setDomainQuery);
  const analyzeDomain = useToolsStore((state) => state.analyzeDomain);

  useEffect(() => {
    if (!domainQuery.trim() && project?.rootUrl)
      setDomainQuery(project.rootUrl);
  }, [domainQuery, project?.rootUrl, setDomainQuery]);

  const run = (event: React.FormEvent) => {
    event.preventDefault();
    if (domainQuery.trim()) void analyzeDomain(domainQuery.trim());
  };

  const metrics = domainOverview
    ? [
        {
          label: t('domainResearchUi.monthlyTraffic'),
          value: domainOverview.organic_traffic?.toLocaleString(appLocale()) ?? '—',
          detail: t('domainResearchUi.estimatedVisitors'),
        },
        {
          label: t('domainResearchUi.organicKeywords'),
          value: domainOverview.organic_keywords?.toLocaleString(appLocale()) ?? '—',
          detail: t('domainResearchUi.rankedTop100'),
        },
        {
          label: t('domainResearchUi.referringDomains'),
          value: domainOverview.referring_domains?.toLocaleString(appLocale()) ?? '—',
          detail: t('domainResearchUi.uniqueRootDomains'),
        },
        {
          label: t('domainResearchUi.domainRank'),
          value: domainOverview.domain_rank?.toLocaleString(appLocale()) ?? '—',
          detail: t('domainResearchUi.authorityStrength'),
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={run}>
        <label className="sr-only" htmlFor="seo-tools-traffic-input">
          {t('seoTools.domainInput')}
        </label>
        <input
          id="seo-tools-traffic-input"
          value={domainQuery}
          onChange={(event) => setDomainQuery(event.target.value)}
          placeholder={t('seoTools.domainPlaceholder')}
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400"
        />
        <button
          type="submit"
          disabled={isLoading || !domainQuery.trim()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4" aria-hidden="true" />
          )}
          {isLoading ? t('seoTools.loading') : t('seoTools.lookup')}
        </button>
      </form>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-xs leading-5 text-rose-200"
        >
          {error}
        </p>
      )}
      {metrics.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                {metric.label}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-100">
                {metric.value}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                {metric.detail}
              </p>
            </div>
          ))}
        </div>
      )}
      {!isLoading && !error && !domainOverview && (
        <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-xs leading-5 text-slate-400">
          {t('seoTools.noTraffic')}
        </p>
      )}
      <p className="text-[11px] leading-5 text-slate-500">
        {t('seoTools.liveOnly')}
      </p>
    </div>
  );
};
