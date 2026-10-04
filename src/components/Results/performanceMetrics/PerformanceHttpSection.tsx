import React from 'react';
import type { TFunction } from 'i18next';
import type { PageAuditData } from '@/types';
import { appLocale } from '@/services/localeFormat';

interface PerformanceHttpSectionProps {
  httpPerformance: NonNullable<PageAuditData['http_performance']>;
  t: TFunction;
}

export const PerformanceHttpSection: React.FC<PerformanceHttpSectionProps> = ({ httpPerformance, t }) => {
  const measuredAt = httpPerformance.measured_at ? new Date(httpPerformance.measured_at) : null;
  const measuredAtLabel = measuredAt && !Number.isNaN(measuredAt.getTime()) ? measuredAt.toLocaleString(appLocale()) : '—';

  return (
    <section
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
      aria-labelledby="http-measurement-title"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="http-measurement-title" className="text-sm font-bold text-white">
            {t('performance.httpMeasurement')}
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-slate-400">{t('performance.httpMeasurementScope')}</p>
        </div>
        <span className="text-xs text-slate-500">
          {t('performance.measuredAt')}: {measuredAtLabel}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <dt className="text-slate-400">{t('performance.responseHeaders')}</dt>
          <dd className="mt-1 font-mono text-base font-bold text-white">
            {httpPerformance.response_headers_ms} {t('performance.milliseconds')}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <dt className="text-slate-400">{t('performance.bodyRead')}</dt>
          <dd className="mt-1 font-mono text-base font-bold text-white">
            {httpPerformance.body_read_ms} {t('performance.milliseconds')}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <dt className="text-slate-400">{t('performance.totalRequest')}</dt>
          <dd className="mt-1 font-mono text-base font-bold text-white">
            {httpPerformance.total_request_ms} {t('performance.milliseconds')}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <dt className="text-slate-400">{t('performance.decodedBody')}</dt>
          <dd className="mt-1 font-mono text-base font-bold text-white">
            {t('exportUi.statuses.bytes', { value: httpPerformance.decoded_body_bytes.toLocaleString(appLocale()) })}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <dt className="text-slate-400">{t('performance.contentLength')}</dt>
          <dd className="mt-1 font-mono text-base font-bold text-white">
            {httpPerformance.content_length_header_bytes == null
              ? '—'
              : t('exportUi.statuses.bytes', {
                  value: httpPerformance.content_length_header_bytes.toLocaleString(appLocale()),
                })}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <dt className="text-slate-400">{t('performance.redirects')}</dt>
          <dd className="mt-1 font-mono text-base font-bold text-white">{httpPerformance.redirect_hops}</dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <dt className="text-slate-400">{t('performance.method')}</dt>
          <dd className="mt-1 font-mono text-base font-bold text-white">{httpPerformance.method}</dd>
        </div>
      </dl>
    </section>
  );
};
