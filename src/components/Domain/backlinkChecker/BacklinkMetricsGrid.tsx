import React from 'react';
import { Link2, Globe, Layers, Shield } from 'lucide-react';
import { TrendChart } from '@/components/Charts/TrendChart';
import type { BacklinkProfileData, BacklinkProfileHistory } from '@/types';
import type { TFunction } from 'i18next';
import { appLocale } from '@/services/localeFormat';

interface BacklinkMetricsGridProps {
  profile: BacklinkProfileData;
  history: BacklinkProfileHistory;
  t: TFunction;
}

export const BacklinkMetricsGrid: React.FC<BacklinkMetricsGridProps> = ({
  profile,
  history,
  t,
}) => {
  const domainHistory = history.filter(
    (snapshot) => snapshot.domain === profile.domain,
  );

  return (
    <div className="space-y-8">
      {/* Key Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <Link2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('backlinkUi.totalBacklinks')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {profile.total_backlinks.toLocaleString(appLocale())}
          </div>
          <span className="text-[11px] text-slate-500">
            {t('backlinkUi.knownInbound')}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('backlinkUi.referringDomains')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {profile.referring_domains.toLocaleString(appLocale())}
          </div>
          <span className="text-[11px] text-slate-500">
            {t('backlinkUi.uniqueRoots')}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>{t('backlinkUi.referringSubnets')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {profile.referring_subnets?.toLocaleString(appLocale()) ?? '—'}
          </div>
          <span className="text-[11px] text-slate-500">
            {t('backlinkUi.classC')}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('backlinkUi.domainRank')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {profile.domain_rank} / 100
          </div>
          <span className="text-[11px] text-slate-500">
            {t('backlinkUi.backlinkAuthority')}
          </span>
        </div>
      </div>

      {domainHistory.length > 1 && (
        <section
          className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/30 p-4"
          aria-labelledby="backlink-profile-history-title"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h2
                id="backlink-profile-history-title"
                className="text-sm font-semibold text-slate-200"
              >
                {t('backlinkUi.historyTitle')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('backlinkUi.historyDescription')}
              </p>
            </div>
            <span className="text-[11px] text-slate-500">
              {t('backlinkUi.historySnapshots', {
                count: domainHistory.length,
              })}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                key: 'totalBacklinksTrend',
                values: domainHistory.map((s) => s.total_backlinks),
              },
              {
                key: 'referringDomainsTrend',
                values: domainHistory.map((s) => s.referring_domains),
              },
              {
                key: 'domainRankTrend',
                values: domainHistory.map((s) => s.domain_rank),
              },
              {
                key: 'dofollowTrend',
                values: domainHistory.map((s) => s.dofollow_ratio),
              },
            ].map((metric) => (
              <div
                key={metric.key}
                className="rounded-md border border-slate-800/80 bg-slate-900/60 p-3"
              >
                <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                  {t(`backlinkUi.${metric.key}`)}
                </p>
                <TrendChart
                  values={metric.values}
                  label={`${t(`backlinkUi.${metric.key}`)} — ${profile.domain}`}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
