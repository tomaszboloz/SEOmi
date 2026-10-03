import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { TFunction } from 'i18next';

interface SecurityScoreBannerProps {
  score: number;
  t: TFunction;
}

export const SecurityScoreBanner: React.FC<SecurityScoreBannerProps> = ({ score, t }) => {
  const scoreColor =
    score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400';
  const scoreBg =
    score >= 80
      ? 'bg-emerald-500/10 border-emerald-500/20'
      : score >= 50
      ? 'bg-amber-500/10 border-amber-500/20'
      : 'bg-rose-500/10 border-rose-500/20';

  return (
    <div
      className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${scoreBg}`}
    >
      <div className="flex items-center space-x-4">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
          <ShieldCheck className={`w-8 h-8 ${scoreColor}`} />
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t('security.securityScore')}
          </span>
          <h3 className="text-xl font-bold text-white mt-0.5">
            {score >= 80
              ? t('legacyUi.security.hardened')
              : score >= 50
              ? t('legacyUi.security.moderate')
              : t('legacyUi.security.vulnerable')}
          </h3>
          <p className="text-xs text-slate-400 mt-1">{t('legacyUi.security.evaluated')}</p>
        </div>
      </div>

      <div className="text-center sm:text-right">
        <span className={`text-4xl font-black font-mono ${scoreColor}`}>{score}%</span>
      </div>
    </div>
  );
};
