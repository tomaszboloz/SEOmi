import React from 'react';
import type { TFunction } from 'i18next';
import type { PageAuditData } from '@/types';

interface SecurityTransportSectionProps {
  transport: PageAuditData['transport_security'];
  t: TFunction;
}

export const SecurityTransportSection: React.FC<SecurityTransportSectionProps> = ({
  transport,
  t,
}) => {
  if (!transport) return null;

  return (
    <section
      aria-label={t('legacyUi.security.transportAria')}
      className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
          {t('legacyUi.security.transportCookies')}
        </h4>
        <span
          className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
            transport.https
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
          }`}
        >
          {transport.scheme.toUpperCase()} ·{' '}
          {transport.https ? t('legacyUi.security.https') : t('legacyUi.security.withoutHttps')}
        </span>
      </div>

      {transport.mixed_content_urls.length > 0 ? (
        <div className="border-b border-slate-800 p-4">
          <p className="text-xs font-semibold text-rose-200">
            {t('legacyUi.security.mixedHttp', { count: transport.mixed_content_urls.length })}
          </p>
          <ul className="mt-2 space-y-1">
            {transport.mixed_content_urls.map((url) => (
              <li key={url} className="break-all font-mono text-[10px] text-rose-100">
                {url}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {t('legacyUi.security.noMixedHttp')}
        </p>
      )}

      {transport.cookies.length > 0 ? (
        <div className="divide-y divide-slate-800/80">
          <p className="px-4 pt-3 text-[10px] text-slate-500">{t('legacyUi.security.cookieNote')}</p>
          {transport.cookies.map((cookie) => (
            <div key={cookie.name} className="flex flex-wrap items-center gap-2 px-4 py-3 text-[10px]">
              <span className="mr-auto font-mono text-slate-100">{cookie.name}</span>
              <span className={cookie.secure ? 'text-emerald-300' : 'text-amber-300'}>
                {t('legacyUi.security.secure')} {cookie.secure ? '✓' : t('legacyUi.security.none')}
              </span>
              <span className={cookie.http_only ? 'text-emerald-300' : 'text-amber-300'}>
                {t('legacyUi.security.httpOnly')} {cookie.http_only ? '✓' : t('legacyUi.security.none')}
              </span>
              <span className={cookie.same_site ? 'text-emerald-300' : 'text-amber-300'}>
                {t('uiUnits.sameSite')} {cookie.same_site || t('legacyUi.security.none')}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {t('legacyUi.security.noCookies')}
        </p>
      )}

      <p className="px-4 py-3 text-[10px] leading-4 text-slate-500">
        {transport.tls_coverage}. {t('legacyUi.security.staticMixed')}
      </p>
    </section>
  );
};
