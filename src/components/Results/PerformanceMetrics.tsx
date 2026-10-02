import React from 'react';
import { useTranslation } from 'react-i18next';

import { PageAuditData } from '@/types';
import { appLocale } from '@/services/localeFormat';
import { CrawlFilesDiscovery } from './CrawlFilesDiscovery';
import { RedirectChainWaterfall } from './RedirectChainWaterfall';

interface PerformanceMetricsProps {
  audit: PageAuditData;
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ audit }) => {
  const { t } = useTranslation();

  const measuredHeadersMs = audit.http_performance?.response_headers_ms ?? audit.response_time_ms;
  const isFast = measuredHeadersMs < 800;
  const isModerate = measuredHeadersMs >= 800 && measuredHeadersMs < 2000;
  const measuredAt = audit.http_performance?.measured_at
    ? new Date(audit.http_performance.measured_at)
    : null;
  const measuredAtLabel = measuredAt && !Number.isNaN(measuredAt.getTime())
    ? measuredAt.toLocaleString(appLocale())
    : '—';

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
      {/* Native HTTP response timing; not a browser TTFB or Core Web Vital. */}
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
            {isFast ? t('performance.fastHttpResponse') : isModerate ? t('performance.moderateHttpLatency') : t('performance.slowHttpResponse')}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t('performance.totalHops')}
          </span>
          <div className="my-2">
            <span className="text-3xl font-extrabold font-mono text-white">
              {audit.redirect_chain.length}
            </span>
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

      {audit.http_performance && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5" aria-labelledby="http-measurement-title">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 id="http-measurement-title" className="text-sm font-bold text-white">
                {t('performance.httpMeasurement')}
              </h3>
              <p className="mt-1 max-w-2xl text-xs text-slate-400">
                {t('performance.httpMeasurementScope')}
              </p>
            </div>
            <span className="text-xs text-slate-500">
              {t('performance.measuredAt')}: {measuredAtLabel}
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <dt className="text-slate-400">{t('performance.responseHeaders')}</dt>
              <dd className="mt-1 font-mono text-base font-bold text-white">{audit.http_performance.response_headers_ms} {t('performance.milliseconds')}</dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <dt className="text-slate-400">{t('performance.bodyRead')}</dt>
              <dd className="mt-1 font-mono text-base font-bold text-white">{audit.http_performance.body_read_ms} {t('performance.milliseconds')}</dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <dt className="text-slate-400">{t('performance.totalRequest')}</dt>
              <dd className="mt-1 font-mono text-base font-bold text-white">{audit.http_performance.total_request_ms} {t('performance.milliseconds')}</dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <dt className="text-slate-400">{t('performance.decodedBody')}</dt>
              <dd className="mt-1 font-mono text-base font-bold text-white">
                {t('exportUi.statuses.bytes', { value: audit.http_performance.decoded_body_bytes.toLocaleString(appLocale()) })}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <dt className="text-slate-400">{t('performance.contentLength')}</dt>
              <dd className="mt-1 font-mono text-base font-bold text-white">
                {audit.http_performance.content_length_header_bytes == null
                  ? '—'
                  : t('exportUi.statuses.bytes', { value: audit.http_performance.content_length_header_bytes.toLocaleString(appLocale()) })}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <dt className="text-slate-400">{t('performance.redirects')}</dt>
              <dd className="mt-1 font-mono text-base font-bold text-white">{audit.http_performance.redirect_hops}</dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <dt className="text-slate-400">{t('performance.method')}</dt>
              <dd className="mt-1 font-mono text-base font-bold text-white">{audit.http_performance.method}</dd>
            </div>
          </dl>
        </section>
      )}

      <RedirectChainWaterfall audit={audit} />

      <CrawlFilesDiscovery audit={audit} />
    </div>
  );
};
