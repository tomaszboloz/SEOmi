import React from 'react';
import { Globe2, Search, Link2, Loader2, Layers } from 'lucide-react';
import { DataForSeoLanguagePicker, DataForSeoLocationPicker } from '@/components/DataForSEO/DataForSeoPickers';
import { dataForSeoLanguage, dataForSeoMarket } from '@/services/dataforseo';
import type { DomainOverviewSession } from './useDomainOverviewSession';

export const DomainOverviewHeader: React.FC<{ session: DomainOverviewSession }> = ({
  session,
}) => {
  const {
    t,
    inputDomain,
    setInputDomain,
    domainCountry,
    setDomainCountry,
    domainLanguage,
    setDomainLanguage,
    domainOverview,
    isLoading,
    error,
    handleAnalyze,
    handleNavigateBacklinks,
    handleNavigateSiteAudit,
  } = session;

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {t('domainResearchUi.badge')}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {t('domainResearchUi.eyebrow')}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            {t('domainResearchUi.title')}
          </h1>
          <p className="text-sm text-slate-400">
            {t('domainResearchUi.description')}
          </p>
        </div>

        {domainOverview && (
          <div className="flex items-center space-x-3">
            <button
              onClick={handleNavigateBacklinks}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition"
            >
              <Link2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('domainResearchUi.backlinkProfile')}</span>
            </button>
            <button
              onClick={handleNavigateSiteAudit}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 transition shadow-md shadow-emerald-950"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('domainResearchUi.runCrawler')}</span>
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-amber-200">
        {t('dataforseo.paidRequests', { count: 5 })}
      </p>

      <form
        onSubmit={handleAnalyze}
        className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row gap-3 shadow-lg"
      >
        <div className="flex-1 relative">
          <Globe2 className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={inputDomain}
            onChange={(e) => setInputDomain(e.target.value)}
            placeholder={t('domainResearchUi.domainPlaceholder')}
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
          />
        </div>

        <DataForSeoLocationPicker
          value={domainCountry}
          onChange={(country) => {
            setDomainCountry(country);
            setDomainLanguage(dataForSeoLanguage(country, domainLanguage));
          }}
          ariaLabel={t('dataforseo.locationLabel')}
          placeholder={t('dataforseo.locationLabel')}
          className="w-full md:w-56"
        />
        <DataForSeoLanguagePicker
          value={domainLanguage}
          market={dataForSeoMarket(domainCountry)}
          onChange={setDomainLanguage}
          ariaLabel={t('dataforseo.languageLabel')}
          placeholder={t('dataforseo.languageLabel')}
          className="w-full md:w-48"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-950"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('domainResearchUi.scanning')}</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span>{t('domainResearchUi.analyze')}</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm">
          {error}
        </div>
      )}
    </>
  );
};
