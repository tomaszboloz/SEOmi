import React from 'react';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { PageAuditData } from '@/types';

interface PerformanceRedirectWaterfallProps {
  redirectChain: PageAuditData['redirect_chain'];
  finalUrl: string;
  httpStatus: number;
  t: TFunction;
}

export const PerformanceRedirectWaterfall: React.FC<PerformanceRedirectWaterfallProps> = ({
  redirectChain,
  finalUrl,
  httpStatus,
  t,
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Clock className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-white">{t('performance.redirectChain')}</h3>
      </div>

      {redirectChain.length === 0 ? (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center space-x-3 text-xs text-emerald-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="font-semibold block">{t('performance.directConnection')}</span>
            <span className="text-slate-400">{t('performance.noRedirectOverhead')}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3 relative before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
          {redirectChain.map((hop, idx) => (
            <div key={idx} className="relative pl-8 flex items-center justify-between text-xs group">
              <div className="absolute left-1.5 w-3.5 h-3.5 rounded-full bg-slate-800 border-2 border-amber-400" />
              <div className="min-w-0 flex-1 pr-4">
                <div className="font-mono text-slate-300 truncate">{hop.url}</div>
                {hop.location && (
                  <div className="text-[11px] text-slate-500 truncate flex items-center space-x-1 mt-0.5">
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span>{hop.location}</span>
                  </div>
                )}
              </div>
              <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                {t('exportUi.statuses.http', { status: hop.status_code })}
              </span>
            </div>
          ))}

          {/* Final Target Destination */}
          <div className="relative pl-8 flex items-center justify-between text-xs">
            <div className="absolute left-1.5 w-3.5 h-3.5 rounded-full bg-slate-800 border-2 border-emerald-400" />
            <div className="min-w-0 flex-1 pr-4 font-mono text-emerald-300 truncate font-semibold">
              {finalUrl}
            </div>
            <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              {t('exportUi.statuses.http', { status: httpStatus })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
