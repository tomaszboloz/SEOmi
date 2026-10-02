import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Plus,
  Check,
  TrendingUp,
  DollarSign,
  BarChart2,
  Loader2,
  Filter,
  Sparkles,
} from 'lucide-react';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { SearchIntent } from '@/types';
import { TrendChart } from '@/components/Charts/TrendChart';
import { DataForSeoLanguagePicker, DataForSeoLocationPicker } from '@/components/DataForSEO/DataForSeoPickers';
import { dataForSeoLanguage, dataForSeoMarket } from '@/services/dataforseo';
import { appLocale } from '@/services/localeFormat';

export const KeywordResearch: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const keywordQuery = useToolsStore((s) => s.keywordQuery);
  const keywordCountry = useToolsStore((s) => s.keywordCountry);
  const keywordLanguage = useToolsStore((s) => s.keywordLanguage);
  const keywordResults = useToolsStore((s) => s.keywordResults);
  const isLoading = useToolsStore((s) => s.isKeywordLoading);
  const error = useToolsStore((s) => s.keywordError);
  const setKeywordQuery = useToolsStore((s) => s.setKeywordQuery);
  const setKeywordCountry = useToolsStore((s) => s.setKeywordCountry);
  const setKeywordLanguage = useToolsStore((s) => s.setKeywordLanguage);
  const searchKeywords = useToolsStore((s) => s.searchKeywords);
  const addSavedKeyword = useToolsStore((s) => s.addSavedKeyword);
  const savedKeywords = useToolsStore((s) => s.savedKeywords);

  const [inputQuery, setInputQuery] = useState(keywordQuery);
  const [selectedCountry, setSelectedCountry] = useState(keywordCountry);
  const [selectedLanguage, setSelectedLanguage] = useState(keywordLanguage);
  const [intentFilter, setIntentFilter] = useState<string>('all');
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setInputQuery(keywordQuery);
    setSelectedCountry(keywordCountry);
    setSelectedLanguage(keywordLanguage);
    setIntentFilter('all');
    setSavedIds({});
  }, [activeProjectId, keywordCountry, keywordLanguage, keywordQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim()) return;
    setKeywordQuery(inputQuery.trim());
    setKeywordCountry(selectedCountry);
    setKeywordLanguage(selectedLanguage);
    searchKeywords(inputQuery.trim(), selectedCountry, selectedLanguage);
  };

  const handleSave = (item: (typeof keywordResults)[0]) => {
    addSavedKeyword({
      keyword: item.keyword,
      search_volume: item.search_volume,
      difficulty: item.difficulty,
      cpc: item.cpc,
      intent: item.intent,
      tags: [t('keywordResearchUi.researchTag')],
    });
    setSavedIds((prev) => ({ ...prev, [item.keyword]: true }));
  };

  const filteredResults = keywordResults.filter((item) => {
    if (intentFilter === 'all') return true;
    return item.intent.toLowerCase() === intentFilter.toLowerCase();
  });

  const primaryItem = keywordResults[0];

  const intentLabel = (intent: SearchIntent | string) => t(`keywordResearchUi.intent.${intent.toLowerCase()}`);

  const getIntentBadge = (intent: SearchIntent) => {
    switch (intent) {
      case 'Informational':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Commercial':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Transactional':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Navigational':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    }
  };

  const getDifficultyColor = (diff: number) => {
    if (diff < 30) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (diff < 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {t('keywordResearchUi.badge')}
            </span>
            <span className="text-xs text-slate-400 font-mono">{t('keywordResearchUi.provider')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">{t('keywordResearchUi.title')}</h1>
          <p className="text-sm text-slate-400">
            {t('keywordResearchUi.description')}
          </p>
        </div>
      </div>

      {/* Search Bar Form */}
      <p className="text-xs text-amber-200">{t('dataforseo.paidRequests', { count: 1 })}</p>
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

      {/* Primary Keyword Overview Card */}
      {primaryItem && (
        <div className="p-6 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">{t('keywordResearchUi.primaryKeyword')}</span>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3 mt-1">
                {primaryItem.keyword}
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-normal ${getIntentBadge(primaryItem.intent)}`}>
                  {intentLabel(primaryItem.intent)} · {t('keywordResearchUi.intentLabel')}
                </span>
              </h2>
            </div>

            <button
              onClick={() => handleSave(primaryItem)}
              disabled={savedIds[primaryItem.keyword] || savedKeywords.some((k) => k.keyword === primaryItem.keyword)}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-2 transition disabled:opacity-60"
            >
              {savedIds[primaryItem.keyword] || savedKeywords.some((k) => k.keyword === primaryItem.keyword) ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{t('keywordResearchUi.saved')}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>{t('keywordResearchUi.addSaved')}</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('keywordResearchUi.monthlyVolume')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {primaryItem.search_volume.toLocaleString(appLocale())}
              </div>
              <span className="text-[11px] text-slate-500">{t('keywordResearchUi.searchesPerMonth')}</span>
            </div>

            <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('keywordResearchUi.keywordDifficulty')}</span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold font-mono text-white">{primaryItem.difficulty}</span>
                <span className="text-xs text-slate-400 font-mono">/ 100</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    primaryItem.difficulty < 30
                      ? 'bg-emerald-400'
                      : primaryItem.difficulty < 60
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                  style={{ width: `${primaryItem.difficulty}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('keywordResearchUi.estimatedCpc')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">${primaryItem.cpc.toFixed(2)}</div>
              <span className="text-[11px] text-slate-500">{t('keywordResearchUi.adwordsBenchmark')}</span>
            </div>

            <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>{t('keywordResearchUi.competition')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {Math.round(primaryItem.competition * 100)}%
              </div>
              <span className="text-[11px] text-slate-500">{t('keywordResearchUi.paidCompetitiveIndex')}</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium text-slate-300">{t('keywordResearchUi.trendTitle')}</span><span className="text-slate-500">{t('keywordResearchUi.providerResponse')}</span></div>
            <TrendChart values={primaryItem.trend} label={t('keywordResearchUi.trendAria', { keyword: primaryItem.keyword })} />
          </div>
        </div>
      )}

      {/* Related Keywords Ideas Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>{t('keywordResearchUi.relatedOpportunities')}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {filteredResults.length}
            </span>
          </h3>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-400">{t('keywordResearchUi.intentLabel')}:</span>
            {(['all', 'Informational', 'Commercial', 'Transactional', 'Navigational'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setIntentFilter(mode)}
                className={`text-xs px-2.5 py-1 rounded-md transition ${
                  intentFilter.toLowerCase() === mode.toLowerCase()
                    ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {mode === 'all' ? t('keywordResearchUi.all') : intentLabel(mode)}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">{t('keywordResearchUi.keywordQuery')}</th>
                  <th className="px-4 py-3">{t('keywordResearchUi.intentLabel')}</th>
                  <th className="px-4 py-3 text-right">{t('keywordResearchUi.volume')}</th>
                  <th className="px-4 py-3 text-center">{t('keywordResearchUi.difficulty')}</th>
                  <th className="px-4 py-3 text-right">{t('keywordResearchUi.cpc')}</th>
                  <th className="px-4 py-3 text-right">{t('keywordResearchUi.action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredResults.map((item, i) => {
                  const isSaved =
                    savedIds[item.keyword] || savedKeywords.some((k) => k.keyword === item.keyword);
                  return (
                    <tr key={i} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3.5 font-medium text-slate-200">
                        <span className="hover:text-emerald-400 cursor-pointer transition">{item.keyword}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${getIntentBadge(item.intent)}`}>
                          {intentLabel(item.intent)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-200">
                        {item.search_volume.toLocaleString(appLocale())}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-md font-mono border ${getDifficultyColor(item.difficulty)}`}>
                          {item.difficulty} / 100
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-300">${item.cpc.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleSave(item)}
                          disabled={isSaved}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition inline-flex items-center space-x-1.5 ${
                            isSaved
                              ? 'bg-slate-800 text-emerald-400 border-slate-700 opacity-80 cursor-default'
                              : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30'
                          }`}
                        >
                          {isSaved ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>{t('keywordResearchUi.saved')}</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>{t('keywordResearchUi.save')}</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
