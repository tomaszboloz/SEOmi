import React from 'react';
import { Loader2, Search } from 'lucide-react';
import { useDomainAgeLookup } from './useDomainAgeLookup';
import { ageInDays } from './seoToolsTypes';

export const DomainAgePanel: React.FC = () => {
  const {
    t,
    i18n,
    domain,
    updateDomain,
    record,
    registrationDate,
    error,
    loading,
    check,
  } = useDomainAgeLookup();

  const days = registrationDate ? ageInDays(registrationDate) : null;
  const formattedDate = registrationDate
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
        new Date(registrationDate),
      )
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="seo-tools-domain-age-input">
          {t('seoTools.domainInput')}
        </label>
        <input
          id="seo-tools-domain-age-input"
          value={domain}
          onChange={(event) => updateDomain(event.target.value)}
          placeholder={t('seoTools.domainPlaceholder')}
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400"
        />
        <button
          type="button"
          onClick={() => void check()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4" aria-hidden="true" />
          )}
          {loading ? t('seoTools.loading') : t('seoTools.lookup')}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200"
        >
          {error}
        </p>
      )}
      {record && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {t('seoTools.domain')}
            </p>
            <p className="mt-2 break-all text-sm font-semibold text-slate-100">
              {record.ldhName || domain}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {t('seoTools.registrationDate')}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-100">
              {formattedDate || t('seoTools.notAvailable')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {t('seoTools.domainAge')}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-100">
              {days === null
                ? t('seoTools.notAvailable')
                : t('seoTools.ageDays', { count: days })}
            </p>
          </div>
        </div>
      )}
      <p className="text-[11px] leading-5 text-slate-500">
        {t('seoTools.rdapNote')}
      </p>
    </div>
  );
};
