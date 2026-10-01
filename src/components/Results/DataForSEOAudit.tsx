import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Database,
  Link2,
  Globe2,
  TrendingUp,
  Search,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Save,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { PageAuditData } from '@/types';
import { useAuditStore } from '@/stores/auditStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';
import { DATAFORSEO_MARKETS, clearDataForSeoTaskLog, dataForSeoLanguage, dataForSeoMarketByLocation, readDataForSeoTaskLog, type DataForSeoTaskRecord } from '@/services/dataforseo';
import { DataForSeoLanguagePicker, DataForSeoLocationPicker } from '@/components/DataForSEO/DataForSeoPickers';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';

interface DataForSEOAuditProps {
  /** Optional: DataForSEO is also a project-level workflow and must remain
   * usable before a page audit exists. */
  audit?: PageAuditData;
}

const serpInputKey = (projectId: string) => `seomi_project_${projectId}_dataforseo_serp_input_v1`;
const defaultMarket = (DATAFORSEO_MARKETS.find((market) => market.code === 'US') || DATAFORSEO_MARKETS[0])!;
const defaultLocationCode = defaultMarket?.locationCode || 2840;
const defaultLanguageCode = defaultMarket?.languages[0]?.code || 'en';
const validLocationCodes = new Set(DATAFORSEO_MARKETS.map((market) => market.locationCode));

export const DataForSEOAudit: React.FC<DataForSEOAuditProps> = ({ audit }) => {
  const { t } = useTranslation();
  const dataforseoData = useAuditStore((s) => s.dataforseoData);
  const dataforseoSerp = useAuditStore((s) => s.dataforseoSerp);
  const isLoading = useAuditStore((s) => s.isDataForSEOLoading);
  const dataforseoError = useAuditStore((s) => s.dataforseoError);
  const fetchDataForSEO = useAuditStore((s) => s.fetchDataForSEO);
  const fetchDataForSEOSerp = useAuditStore((s) => s.fetchDataForSEOSerp);

  const credentials = useSettingsStore((s) => s.dataForSeoCredentials);
  const saveCredentials = useSettingsStore((s) => s.saveDataForSeoCredentials);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useProjectStore((s) => s.projects.find((project) => project.id === s.activeProjectId));

  const [showCredentials, setShowCredentials] = useState(false);
  const [login, setLogin] = useState(credentials.login);
  const [password, setPassword] = useState(credentials.password);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [keyword, setKeyword] = useState('');
  const [locationCode, setLocationCode] = useState(defaultLocationCode);
  const [languageCode, setLanguageCode] = useState(defaultLanguageCode);
  const [inputProjectId, setInputProjectId] = useState<string | null>(null);
  const [taskLog, setTaskLog] = useState<DataForSeoTaskRecord[]>([]);
  const [showTaskLog, setShowTaskLog] = useState(false);

  // SERP input is a project preference, not a fabricated query. Hydrate it
  // before persisting changes so switching projects cannot overwrite the
  // destination project's saved market or keyword with the previous one.
  useEffect(() => {
    if (!activeProjectId) {
      setKeyword('');
      setLocationCode(defaultLocationCode);
      setLanguageCode(defaultLanguageCode);
      setInputProjectId(null);
      return;
    }
    const saved = readJsonStorage<{ keyword?: unknown; locationCode?: unknown; languageCode?: unknown } | null>(serpInputKey(activeProjectId), null);
    const savedLocation = typeof saved?.locationCode === 'number' && validLocationCodes.has(saved.locationCode)
      ? saved.locationCode
      : defaultLocationCode;
    const market = dataForSeoMarketByLocation(savedLocation);
    const savedLanguage = typeof saved?.languageCode === 'string' && market?.languages.some((item) => item.code === saved.languageCode)
      ? saved.languageCode
      : market?.languages[0]?.code || defaultLanguageCode;
    setKeyword(typeof saved?.keyword === 'string' ? saved.keyword : '');
    setLocationCode(savedLocation);
    setLanguageCode(savedLanguage);
    setInputProjectId(activeProjectId);
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId || inputProjectId !== activeProjectId) return;
    writeJsonStorage(serpInputKey(activeProjectId), { keyword, locationCode, languageCode });
  }, [activeProjectId, inputProjectId, keyword, locationCode, languageCode]);

  useEffect(() => {
    setLogin(credentials.login);
    setPassword(credentials.password);
  }, [activeProjectId, credentials.login, credentials.password]);

  useEffect(() => {
    const refreshTaskLog = () => setTaskLog(readDataForSeoTaskLog(activeProjectId));
    refreshTaskLog();
    window.addEventListener('seomi:dataforseo-task', refreshTaskLog);
    return () => window.removeEventListener('seomi:dataforseo-task', refreshTaskLog);
  }, [activeProjectId]);

  const clearTaskHistory = () => {
    clearDataForSeoTaskLog(activeProjectId);
    setTaskLog([]);
  };

  const formatTaskTime = (value: string): string => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };

  const taskStatusLabel = (task: DataForSeoTaskRecord): string => {
    if (task.ok) return t('dataforseo.statusOk');
    if (task.statusCode === null) return t('dataforseo.statusMissing');
    return t('dataforseo.statusError');
  };

  const currentDomain = (() => {
    try {
      const target = audit?.final_url || activeProject?.rootUrl || '';
      return new URL(target).hostname;
    } catch {
      // An invalid/missing URL must remain an explicit empty state. Never
      // substitute the application's own domain for live provider evidence.
      return '';
    }
  })();

  const isConfigured = Boolean(credentials.login && credentials.password);
  const quotaOrRateLimitError = Boolean(dataforseoError && /quota|rate\s*limit|too many requests|insufficient funds|balance|HTTP\s+429/i.test(dataforseoError));

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCredentials({ login, password });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleSearchSerp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    fetchDataForSEOSerp(keyword.trim(), locationCode, dataForSeoLanguage(String(locationCode), languageCode));
  };

  const backlinks = dataforseoData?.total_backlinks;
  const referringDomains = dataforseoData?.referring_domains;
  const dofollow = dataforseoData?.dofollow_backlinks;
  const rank = dataforseoData?.rank;
  const broken = dataforseoData?.broken_backlinks;

  const dofollowRatio = backlinks && dofollow != null && backlinks > 0 ? Math.round((dofollow / backlinks) * 100) : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
      {/* Header & Status Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">{t('dataforseo.title')}</h3>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    isConfigured
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}
                >
                  {isConfigured ? t('dataforseo.credentialsSaved') : t('dataforseo.credentialsRequired')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('dataforseo.targetDomain')}: <span className="font-mono text-emerald-400 font-medium">{currentDomain || '—'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCredentials(!showCredentials)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition flex items-center space-x-1.5 border border-slate-700"
            >
              <Key className="w-3.5 h-3.5 text-slate-400" />
              <span>{showCredentials ? t('dataforseo.hideApiKeys') : t('dataforseo.apiCredentials')}</span>
            </button>

            <button
              onClick={() => fetchDataForSEO(currentDomain)}
              disabled={isLoading || !currentDomain}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{t('dataforseo.fetchLiveMetrics')}</span>
            </button>
          </div>
        </div>

        {/* Credentials Form Drawer */}
        {showCredentials && (
          <form
            onSubmit={handleSaveCredentials}
            className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-slate-950/40 p-4 rounded-xl border border-slate-800/80"
          >
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                {t('dataforseo.loginLabel')}
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={t('dataforseo.loginPlaceholder')}
                className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                {t('dataforseo.passwordLabel')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('dataforseo.passwordPlaceholder')}
                className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="submit"
                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1 flex-1"
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    <span>{t('dataforseo.saved')}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{t('dataforseo.saveConnect')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {dataforseoError && (
          <div className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs ${quotaOrRateLimitError ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-rose-500/20 bg-rose-500/10 text-rose-300'}`} role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p>{dataforseoError}</p>
              {quotaOrRateLimitError && <p className="mt-1 text-[11px] text-amber-300/80">{t('dataforseo.quotaHint')}</p>}
            </div>
          </div>
        )}
      </div>

      <section aria-label={t('dataforseo.requestStatus')} className="rounded-2xl border border-slate-800 bg-slate-900/45 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-100">{t('dataforseo.taskState')}</h4>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{t('dataforseo.taskDescription')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-mono text-slate-400">{taskLog.length} / 100</span>
            {taskLog.length > 0 && <button type="button" onClick={clearTaskHistory} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 transition hover:border-rose-400/50 hover:text-rose-200">{t('dataforseo.clearHistory')}</button>}
          </div>
        </div>
        {taskLog.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">{t('dataforseo.noRequests')}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-2">{t('dataforseo.status')}</th><th className="px-3 py-2">{t('dataforseo.endpoint')}</th><th className="px-3 py-2">{t('dataforseo.taskId')}</th><th className="px-3 py-2">{t('dataforseo.cost')}</th><th className="px-3 py-2">{t('dataforseo.time')}</th><th className="px-3 py-2">{t('dataforseo.completed')}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {(showTaskLog ? taskLog : taskLog.slice(0, 5)).map((task) => (
                  <tr key={`${task.completedAt}-${task.endpoint}-${task.taskId || 'request'}`} className="text-slate-300">
                    <td className={`px-3 py-2 font-semibold ${task.ok ? 'text-emerald-300' : 'text-rose-300'}`} title={task.statusMessage || undefined}>{taskStatusLabel(task)}{task.statusCode !== null ? ` · ${task.statusCode}` : ''}</td>
                    <td className="max-w-[250px] truncate px-3 py-2 font-mono text-slate-400" title={task.endpoint}>{task.endpoint.replace(/^\/v3\//, '')}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{task.taskId || '—'}</td>
                    <td className="px-3 py-2 text-slate-400">{task.cost === null ? t('dataforseo.notInResponse') : `$${task.cost.toFixed(4)}`}</td>
                    <td className="px-3 py-2 text-slate-400">{task.timeSeconds === null ? '—' : `${task.timeSeconds.toFixed(3)} s`}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatTaskTime(task.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {taskLog.length > 5 && <button type="button" onClick={() => setShowTaskLog((value) => !value)} className="w-full border-t border-slate-800 px-3 py-2 text-left text-[11px] font-medium text-emerald-300 transition hover:bg-slate-900/80">{showTaskLog ? t('dataforseo.showRecent') : t('dataforseo.showAll', { count: taskLog.length })}</button>}
          </div>
        )}
      </section>

      {/* 4 Big Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Backlinks */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('dataforseo.totalBacklinks')}</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Link2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {backlinks === undefined ? '—' : backlinks.toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center space-x-1">
            {dofollowRatio === null ? <span>{t('dataforseo.runLiveMetric')}</span> : <><span className="text-emerald-400 font-semibold">{dofollowRatio}%</span><span>{t('dataforseo.dofollowBacklinks', { count: dofollow ?? undefined })}</span></>}
          </div>
        </div>

        {/* Card 2: Referring Domains */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('dataforseo.referringDomains')}</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Globe2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {referringDomains === undefined ? '—' : referringDomains.toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {t('dataforseo.mainDomains')}: {dataforseoData ? dataforseoData.referring_main_domains : '—'}
          </div>
        </div>

        {/* Card 3: Domain Rank */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('dataforseo.domainRank')}</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <div className="text-2xl font-black text-white tracking-tight">{rank === undefined ? '—' : rank}</div>
            <span className="text-xs text-slate-400 font-medium">/ 100</span>
          </div>
          <div className="mt-2 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, rank || 0)}%` }}
            />
          </div>
        </div>

        {/* Card 4: Broken Backlinks */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('dataforseo.brokenBacklinks')}</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {broken === undefined ? '—' : broken}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {broken === undefined ? <span>{t('dataforseo.runLiveVerify')}</span> : broken === 0 ? (
              <span className="text-emerald-400 font-medium">✓ {t('dataforseo.noBrokenLinks')}</span>
            ) : (
              <span className="text-rose-400 font-medium">{t('dataforseo.brokenLinksNeedRepair', { count: broken })}</span>
            )}
          </div>
        </div>
      </div>

      {/* SERP Competitor Explorer */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">{t('dataforseo.serpTitle')}</h4>
          </div>

          {/* Keyword Search Form */}
          <form onSubmit={handleSearchSerp} className="flex items-center space-x-2 w-full sm:w-auto">
            <input
              type="text"
              aria-label={t('dataforseo.keywordLabel')}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('dataforseo.keywordPlaceholder')}
              className="h-8 px-3 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48 sm:w-60"
            />
            <DataForSeoLocationPicker
              ariaLabel={t('dataforseo.locationLabel')}
              value={dataForSeoMarketByLocation(locationCode).code}
              onChange={(country) => {
                const nextMarket = /^\d+$/.test(country)
                  ? dataForSeoMarketByLocation(Number(country))
                  : DATAFORSEO_MARKETS.find((market) => market.code === country) || defaultMarket;
                setLocationCode(nextMarket.locationCode);
                // Numeric values are accepted for backwards-compatible deep
                // links and old automated clients. New UI selections use ISO
                // codes and always move to a provider-supported language.
                if (!/^\d+$/.test(country) && !nextMarket.languages.some((language) => language.code === languageCode)) {
                  setLanguageCode(nextMarket.languages[0]?.code || defaultLanguageCode);
                }
              }}
              className="h-8 w-52 min-w-0"
            />
            <DataForSeoLanguagePicker
              ariaLabel={t('dataforseo.languageLabel')}
              value={languageCode}
              market={dataForSeoMarketByLocation(locationCode)}
              onChange={setLanguageCode}
              className="h-8 w-44 min-w-0"
            />
            <button
              type="submit"
              disabled={isLoading || !keyword.trim()}
              className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1 shrink-0 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              <span>{t('dataforseo.inspectSerp')}</span>
            </button>
          </form>
        </div>

        {/* Competitor SERP Table */}
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
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                      #{item.rank_group || idx + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-white truncate max-w-[200px]">
                      {item.domain}
                    </td>
                    <td className="py-3 px-4">
                      <h5 className="font-semibold text-white hover:text-emerald-400 transition cursor-pointer">
                        {item.title}
                      </h5>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
                      >
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
    </div>
  );
};
