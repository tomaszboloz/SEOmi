import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { readStorage, writeStorage } from '@/services/storage';
import { competitorKeywordsInputStorageKey } from './seoToolsTypes';
import { DataForSeoCostMeter } from '@/components/DataForSEO/cost/DataForSeoCostMeter';

export const CompetitorKeywordsPanel: React.FC = () => {
  const { t } = useTranslation();
  const projectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore((state) =>
    state.projects.find((item) => item.id === state.activeProjectId),
  );
  const domainOverview = useToolsStore((state) => state.domainOverview);
  const domainError = useToolsStore((state) => state.domainError);
  const isLoading = useToolsStore((state) => state.isDomainLoading);
  const analyzeDomain = useToolsStore((state) => state.analyzeDomain);
  const [domain, setDomain] = useState(project?.rootUrl || '');

  useEffect(() => {
    setDomain(
      projectId
        ? (readStorage(competitorKeywordsInputStorageKey(projectId)) ??
            project?.rootUrl) || ''
        : '',
    );
  }, [projectId, project?.rootUrl]);

  const keywords =
    domainOverview?.domain ===
    domain
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      ? domainOverview.top_keywords
      : [];

  return (
    <div className="space-y-5">
      <DataForSeoCostMeter />
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void analyzeDomain(domain);
        }}
      >
        <label
          className="sr-only"
          htmlFor="seo-tools-competitor-keywords-input"
        >
          {t('seoTools.competitorDomain')}
        </label>
        <input
          id="seo-tools-competitor-keywords-input"
          value={domain}
          onChange={(event) => {
            const next = event.target.value;
            setDomain(next);
            if (projectId)
              writeStorage(competitorKeywordsInputStorageKey(projectId), next);
          }}
          placeholder={t('seoTools.domainPlaceholder')}
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400"
        />
        <button
          type="submit"
          disabled={isLoading || !domain.trim()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          {isLoading ? t('seoTools.loading') : t('seoTools.loadKeywords')}
        </button>
      </form>
      {domainError && (
        <p
          role="alert"
          className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-xs text-rose-200"
        >
          {domainError}
        </p>
      )}
      {!isLoading && !domainError && !keywords.length && (
        <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-xs leading-5 text-slate-400">
          {t('seoTools.noKeywords')}
        </p>
      )}
      {keywords.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2">{t('seoTools.keyword')}</th>
                <th className="px-3 py-2">{t('seoTools.position')}</th>
                <th className="px-3 py-2">{t('seoTools.volume')}</th>
                <th className="px-3 py-2">{t('seoTools.intent')}</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((item) => (
                <tr
                  key={`${item.keyword}-${item.position}`}
                  className="border-t border-slate-800 text-slate-200"
                >
                  <td className="px-3 py-2">{item.keyword}</td>
                  <td className="px-3 py-2">
                    {item.position ?? t('seoTools.notAvailable')}
                  </td>
                  <td className="px-3 py-2">
                    {item.search_volume ?? t('seoTools.notAvailable')}
                  </td>
                  <td className="px-3 py-2">
                    {item.intent || t('seoTools.notAvailable')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] leading-5 text-slate-500">
        {t('seoTools.liveOnly')}
      </p>
    </div>
  );
};
