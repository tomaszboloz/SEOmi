import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, ArrowRight, FileText, CheckCircle2, ExternalLink } from 'lucide-react';
import { PageAuditData } from '@/types';
import { appLocale } from '@/services/localeFormat';

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

      {/* Redirect Chain Waterfall */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">{t('performance.redirectChain')}</h3>
        </div>

        {audit.redirect_chain.length === 0 ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center space-x-3 text-xs text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold block">{t('performance.directConnection')}</span>
              <span className="text-slate-400">{t('performance.noRedirectOverhead')}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3 relative before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
            {audit.redirect_chain.map((hop, idx) => (
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
                {audit.final_url}
              </div>
              <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                {t('exportUi.statuses.http', { status: audit.http_status })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Crawling Files Discovery */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <FileText className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">{t('performance.crawlingDiscovery')}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Robots.txt */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="font-semibold text-white block mb-0.5">{t('performance.robotsLocation')}</span>
              <span className="font-mono text-slate-400 truncate block">
                {audit.technical.robots_txt_url}
              </span>
            </div>
            {audit.technical.robots_txt_url && (
              <a
                href={audit.technical.robots_txt_url}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition shrink-0"
                title={t('performance.openRobots')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Sitemap.xml */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="font-semibold text-white block mb-0.5">{t('performance.sitemapLocation')}</span>
              <span className="font-mono text-slate-400 truncate block">
                {audit.technical.sitemap_url}
              </span>
            </div>
            {audit.technical.sitemap_url && (
              <a
                href={audit.technical.sitemap_url}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition shrink-0"
                title={t('performance.openSitemap')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
