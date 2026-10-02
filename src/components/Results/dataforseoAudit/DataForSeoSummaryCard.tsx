import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, Globe2, TrendingUp, AlertCircle } from 'lucide-react';
import { useAuditStore } from '@/stores/auditStore';

export const DataForSeoSummaryCard: React.FC = () => {
  const { t } = useTranslation();
  const dataforseoData = useAuditStore((s) => s.dataforseoData);

  const backlinks = dataforseoData?.total_backlinks;
  const referringDomains = dataforseoData?.referring_domains;
  const dofollow = dataforseoData?.dofollow_backlinks;
  const rank = dataforseoData?.rank;
  const broken = dataforseoData?.broken_backlinks;

  const dofollowRatio = backlinks && dofollow != null && backlinks > 0 ? Math.round((dofollow / backlinks) * 100) : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Total Backlinks */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('dataforseo.totalBacklinks')}</span>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Link2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-white tracking-tight">
          {backlinks === undefined ? '—' : backlinks.toLocaleString()}
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center space-x-1">
          {dofollowRatio === null ? <span>{t('dataforseo.runLiveMetric')}</span> : <><span className="text-emerald-400 font-semibold">{dofollowRatio}%</span><span>{t('dataforseo.dofollowBacklinks', { count: dofollow ?? undefined })}</span></>}
        </div>
      </div>

      {/* Card 2: Referring Domains */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('dataforseo.referringDomains')}</span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Globe2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-white tracking-tight">
          {referringDomains === undefined ? '—' : referringDomains.toLocaleString()}
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          {t('dataforseo.mainDomains')}: {dataforseoData ? dataforseoData.referring_main_domains : '—'}
        </div>
      </div>

      {/* Card 3: Domain Rank */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('dataforseo.domainRank')}</span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <div className="text-2xl font-black text-white tracking-tight">{rank === undefined ? '—' : rank}</div>
          <span className="text-xs text-slate-400 font-medium">/ 100</span>
        </div>
        <div className="mt-2 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, rank || 0)}%` }}
          />
        </div>
      </div>

      {/* Card 4: Broken Backlinks */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('dataforseo.brokenBacklinks')}</span>
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-white tracking-tight">
          {broken === undefined ? '—' : broken}
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          {broken === undefined ? <span>{t('dataforseo.runLiveVerify')}</span> : broken === 0 ? (
            <span className="text-emerald-400 font-medium">✓ {t('dataforseo.noBrokenLinks')}</span>
          ) : (
            <span className="text-rose-400 font-medium">{t('dataforseo.brokenLinksNeedRepair', { count: broken })}</span>
          )}
        </div>
      </div>
    </div>
  );
};
