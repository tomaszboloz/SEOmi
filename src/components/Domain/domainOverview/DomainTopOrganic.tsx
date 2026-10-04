import React from 'react';
import { Search, FileText } from 'lucide-react';
import type { DomainOverviewData } from '@/types';
import type { TFunction } from 'i18next';
import { appLocale } from '@/services/localeFormat';

interface DomainTopOrganicProps {
  overview: DomainOverviewData;
  t: TFunction;
}

export const DomainTopOrganic: React.FC<DomainTopOrganicProps> = ({
  overview,
  t,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Keywords */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400" />
            <span>{t('domainResearchUi.topKeywords')}</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {t('domainResearchUi.topTrafficContributors')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500 uppercase border-b border-slate-800">
              <tr>
                <th className="pb-2">{t('domainResearchUi.keyword')}</th>
                <th className="pb-2 text-center">{t('domainResearchUi.position')}</th>
                <th className="pb-2 text-right">{t('domainResearchUi.volume')}</th>
                <th className="pb-2 text-right">{t('domainResearchUi.trafficPercent')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {overview.top_keywords.map((k, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 font-sans font-medium text-slate-200">
                    {k.keyword}
                  </td>
                  <td className="py-2.5 text-center">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      {k.position === null ? '—' : `#${k.position}`}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-slate-300">
                    {k.search_volume?.toLocaleString(appLocale()) ?? '—'}
                  </td>
                  <td className="py-2.5 text-right text-slate-400">
                    {k.traffic_share === null ? '—' : `${k.traffic_share}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Organic Pages */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <span>{t('domainResearchUi.topPages')}</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {t('domainResearchUi.organicVisibility')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500 uppercase border-b border-slate-800">
              <tr>
                <th className="pb-2">{t('domainResearchUi.landingUrl')}</th>
                <th className="pb-2 text-right">{t('domainResearchUi.trafficShare')}</th>
                <th className="pb-2 text-right">{t('domainResearchUi.keywords')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {overview.top_pages.map((p, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 text-slate-300 truncate max-w-[200px]">
                    {p.url}
                  </td>
                  <td className="py-2.5 text-right text-emerald-400 font-bold">
                    {p.traffic_percentage === null ? '—' : `${p.traffic_percentage}%`}
                  </td>
                  <td className="py-2.5 text-right text-slate-400">
                    {p.keywords_count?.toLocaleString(appLocale()) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
