import React from 'react';
import type { TFunction } from 'i18next';
import type { PageAuditData } from '@/types';

interface PerformanceSummaryCardsProps {
  audit: PageAuditData;
  t: TFunction;
}

export const PerformanceSummaryCards: React.FC<PerformanceSummaryCardsProps> = ({ audit, t }) => {
  const measuredHeadersMs = audit.http_performance?.response_headers_ms ?? audit.response_time_ms;
  const isFast = measuredHeadersMs < 800;
  const isModerate = measuredHeadersMs >= 800 && measuredHeadersMs < 2000;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {t('performance.responseHeaders')}
        </span>
        <div className="my-2">
          <span
            className={`text-3xl font-extrabold font-mono ${
              isFast ? 'text-emerald-400' : isModerate ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {measuredHeadersMs}
          </span>
          <span className="text-xs text-slate-400 ml-1">{t('performance.milliseconds')}</span>
        </div>
        <div className="text-xs text-slate-400">
          {isFast
            ? t('performance.fastHttpResponse')
            : isModerate
            ? t('performance.moderateHttpLatency')
            : t('performance.slowHttpResponse')}
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {t('performance.totalHops')}
        </span>
        <div className="my-2">
          <span className="text-3xl font-extrabold font-mono text-white">{audit.redirect_chain.length}</span>
          <span className="text-xs text-slate-400 ml-1">{t('performance.hops')}</span>
        </div>
        <div className="text-xs text-slate-400">
          {audit.redirect_chain.length === 0
            ? t('performance.directConnection')
            : t('performance.redirectsDetected', { count: audit.redirect_chain.length })}
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {t('performance.webServer')}
        </span>
        <div className="my-2 truncate">
          <span className="text-lg font-bold font-mono text-white truncate block">
            {audit.technical.server || t('performance.genericServer')}
          </span>
        </div>
        <div className="text-xs text-slate-400 truncate">
          {audit.technical.content_type || t('performance.htmlContentType')}
        </div>
      </div>
    </div>
  );
};
