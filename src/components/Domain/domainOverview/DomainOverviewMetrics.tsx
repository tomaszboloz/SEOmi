import React from 'react';
import { TrendingUp, Search, Shield, Link2 } from 'lucide-react';
import type { DomainOverviewData } from '@/types';
import type { TFunction } from 'i18next';
import { appLocale } from '@/services/localeFormat';

interface DomainOverviewMetricsProps {
  overview: DomainOverviewData;
  t: TFunction;
}

export const DomainOverviewMetrics: React.FC<DomainOverviewMetricsProps> = ({
  overview,
  t,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('domainResearchUi.monthlyTraffic')}</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono">
          {overview.organic_traffic?.toLocaleString(appLocale()) ?? '—'}
        </div>
        <span className="text-[11px] text-slate-500">
          {t('domainResearchUi.estimatedVisitors')}
        </span>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
          <Search className="w-3.5 h-3.5 text-blue-400" />
          <span>{t('domainResearchUi.organicKeywords')}</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono">
          {overview.organic_keywords?.toLocaleString(appLocale()) ?? '—'}
        </div>
        <span className="text-[11px] text-slate-500">
          {t('domainResearchUi.rankedTop100')}
        </span>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('domainResearchUi.domainRank')}</span>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white font-mono">
            {overview.domain_rank ?? '—'}
          </span>
          {overview.domain_rank !== null && (
            <span className="text-xs text-slate-400 font-mono">/ 100</span>
          )}
        </div>
        <span className="text-[11px] text-slate-500">
          {t('domainResearchUi.authorityStrength')}
        </span>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
          <Link2 className="w-3.5 h-3.5 text-purple-400" />
          <span>{t('domainResearchUi.referringDomains')}</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono">
          {overview.referring_domains?.toLocaleString(appLocale()) ?? '—'}
        </div>
        <span className="text-[11px] text-slate-500">
          {t('domainResearchUi.uniqueRootDomains')}
        </span>
      </div>
    </div>
  );
};
