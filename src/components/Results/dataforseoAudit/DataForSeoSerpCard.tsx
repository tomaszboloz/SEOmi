import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, ExternalLink, Sparkles } from 'lucide-react';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { DATAFORSEO_MARKETS, dataForSeoLanguage, dataForSeoMarketByLocation } from '@/services/dataforseo';
import { DataForSeoLanguagePicker, DataForSeoLocationPicker } from '@/components/DataForSEO/DataForSeoPickers';
import { readJsonRecord } from '@/services/storageContracts';
import { writeJsonStorage } from '@/services/storage';
import { serpInputKey, defaultMarket, defaultLocationCode, defaultLanguageCode, validLocationCodes } from './dataforseoAuditTypes';

export const DataForSeoSerpCard: React.FC = () => {
  const { t } = useTranslation();
  const dataforseoSerp = useAuditStore((s) => s.dataforseoSerp);
  const isLoading = useAuditStore((s) => s.isDataForSEOLoading);
  const fetchDataForSEOSerp = useAuditStore((s) => s.fetchDataForSEOSerp);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const [keyword, setKeyword] = useState('');
  const [locationCode, setLocationCode] = useState(defaultLocationCode);
  const [languageCode, setLanguageCode] = useState(defaultLanguageCode);
  const [inputProjectId, setInputProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProjectId) {
      setKeyword(''); setLocationCode(defaultLocationCode); setLanguageCode(defaultLanguageCode); setInputProjectId(null);
      return;
    }
    const saved = readJsonRecord(serpInputKey(activeProjectId));
    const savedLocation = typeof saved?.locationCode === 'number' && validLocationCodes.has(saved.locationCode) ? saved.locationCode : defaultLocationCode;
    const market = dataForSeoMarketByLocation(savedLocation);
    const savedLanguage = typeof saved?.languageCode === 'string' && market?.languages.some((item) => item.code === saved.languageCode) ? saved.languageCode : market?.languages[0]?.code || defaultLanguageCode;
    setKeyword(typeof saved?.keyword === 'string' ? saved.keyword : '');
    setLocationCode(savedLocation); setLanguageCode(savedLanguage); setInputProjectId(activeProjectId);
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId || inputProjectId !== activeProjectId) return;
    writeJsonStorage(serpInputKey(activeProjectId), { keyword, locationCode, languageCode });
  }, [activeProjectId, inputProjectId, keyword, locationCode, languageCode]);

  const handleSearchSerp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    fetchDataForSEOSerp(keyword.trim(), locationCode, dataForSeoLanguage(String(locationCode), languageCode));
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-bold text-white">{t('dataforseo.serpTitle')}</h4>
        </div>

        <form onSubmit={handleSearchSerp} className="flex items-center space-x-2 w-full sm:w-auto">
          <input type="text" aria-label={t('dataforseo.keywordLabel')} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={t('dataforseo.keywordPlaceholder')} className="h-8 px-3 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48 sm:w-60" />
          <DataForSeoLocationPicker
            ariaLabel={t('dataforseo.locationLabel')}
            value={dataForSeoMarketByLocation(locationCode).code}
            onChange={(country) => {
              const nextMarket = /^\d+$/.test(country) ? dataForSeoMarketByLocation(Number(country)) : DATAFORSEO_MARKETS.find((m) => m.code === country) || defaultMarket;
              setLocationCode(nextMarket.locationCode);
              if (!/^\d+$/.test(country) && !nextMarket.languages.some((l) => l.code === languageCode)) {
                setLanguageCode(nextMarket.languages[0]?.code || defaultLanguageCode);
              }
            }}
            className="h-8 w-52 min-w-0"
          />
          <DataForSeoLanguagePicker ariaLabel={t('dataforseo.languageLabel')} value={languageCode} market={dataForSeoMarketByLocation(locationCode)} onChange={setLanguageCode} className="h-8 w-44 min-w-0" />
          <button type="submit" disabled={isLoading || !keyword.trim()} className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1 shrink-0 disabled:opacity-50">
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            <span>{t('dataforseo.inspectSerp')}</span>
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 w-16 text-center">{t('dataforseo.rank')}</th>
              <th className="py-3 px-4 w-48">{t('dataforseo.domain')}</th>
              <th className="py-3 px-4">{t('dataforseo.titleDescription')}</th>
              <th className="py-3 px-4 w-28 text-right">{t('dataforseo.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-slate-300">
            {dataforseoSerp.length > 0 ? (
              dataforseoSerp.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">#{item.rank_group || idx + 1}</td>
                  <td className="py-3 px-4 font-mono font-medium text-white truncate max-w-[200px]">{item.domain}</td>
                  <td className="py-3 px-4">
                    <h5 className="font-semibold text-white hover:text-emerald-400 transition cursor-pointer">{item.title}</h5>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium">
                      <span>{t('dataforseo.visit')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  <Sparkles className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                  <span>{t('dataforseo.emptySerp')}</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
