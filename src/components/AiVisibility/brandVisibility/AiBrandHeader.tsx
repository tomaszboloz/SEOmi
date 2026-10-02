import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { TFunction } from 'i18next';

interface AiBrandHeaderProps {
  connectedProvidersCount: number;
  t: TFunction;
}

export const AiBrandHeader: React.FC<AiBrandHeaderProps> = ({
  connectedProvidersCount,
  t,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            {t('aiVisibility.brand.badge')}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {t('aiVisibility.brand.eyebrow')}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white mt-1">{t('aiVisibility.brand.title')}</h1>
        <p className="text-sm text-slate-400">{t('aiVisibility.brand.description')}</p>
      </div>

      <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>
          {connectedProvidersCount
            ? t('aiVisibility.brand.connected', { count: connectedProvidersCount })
            : t('aiVisibility.brand.requiredConnection')}
        </span>
      </div>
    </div>
  );
};
