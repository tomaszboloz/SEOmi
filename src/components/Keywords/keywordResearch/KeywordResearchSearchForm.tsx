import React from 'react';
import { Search, Loader2, Sparkles } from 'lucide-react';
import type { TFunction } from 'i18next';
import {
  DataForSeoLanguagePicker,
  DataForSeoLocationPicker,
} from '@/components/DataForSEO/DataForSeoPickers';
import { dataForSeoLanguage, dataForSeoMarket } from '@/services/dataforseo';

interface KeywordResearchSearchFormProps {
  inputQuery: string;
  setInputQuery: (query: string) => void;
  selectedCountry: string;
  setSelectedCountry: (country: string) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  isLoading: boolean;
  error: string | null;
  handleSearch: (e: React.FormEvent) => void;
  t: TFunction;
}

export const KeywordResearchSearchForm: React.FC<KeywordResearchSearchFormProps> = ({
  inputQuery,
  setInputQuery,
  selectedCountry,
  setSelectedCountry,
  selectedLanguage,
  setSelectedLanguage,
  isLoading,
  error,
  handleSearch,
  t,
}) => {
  return (
    <>
      <p className="text-xs text-amber-200">
        {t('dataforseo.paidRequests', { count: 1 })}
      </p>
      <form
        onSubmit={handleSearch}
        className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row gap-3 shadow-lg"
      >
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={t('keywordResearchUi.searchPlaceholder')}
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <DataForSeoLocationPicker
          value={selectedCountry}
          onChange={(country) => {
            setSelectedCountry(country);
            const nextLanguage = dataForSeoLanguage(country, selectedLanguage);
            setSelectedLanguage(nextLanguage);
          }}
          ariaLabel={t('dataforseo.locationLabel')}
          placeholder={t('dataforseo.locationLabel')}
          className="w-full md:w-56"
        />
        <DataForSeoLanguagePicker
          value={selectedLanguage}
          market={dataForSeoMarket(selectedCountry)}
          onChange={setSelectedLanguage}
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
              <span>{t('keywordResearchUi.analyzing')}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{t('keywordResearchUi.researchIdeas')}</span>
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
