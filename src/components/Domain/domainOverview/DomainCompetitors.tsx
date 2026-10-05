import React from 'react';
import { Users } from 'lucide-react';
import type { DomainOverviewData } from '@/types';
import type { TFunction } from 'i18next';
import { appLocale } from '@/services/localeFormat';

interface DomainCompetitorsProps {
  overview: DomainOverviewData;
  t: TFunction;
}

export const DomainCompetitors: React.FC<DomainCompetitorsProps> = ({
  overview,
  t,
}) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          <span>{t('domainResearchUi.competitors')}</span>
        </h3>
        <span className="text-xs text-slate-400">
          {t('domainResearchUi.landscapeOverlap')}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {overview.competitors.map((c, i) => (
          <div
            key={i}
            className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col justify-between"
          >
            <div>
              <div className="font-bold text-white font-mono text-sm">
                {c.domain}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {c.common_keywords?.toLocaleString(appLocale()) ?? '—'}{' '}
                {t('domainResearchUi.overlappingKeywords')}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
              <span className="text-slate-500">
                {t('domainResearchUi.averagePosition')}
              </span>
              <span className="font-mono font-bold text-amber-400">
                {c.average_position ?? '—'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
