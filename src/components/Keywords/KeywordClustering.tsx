import { keywordClusteringResultSchema } from '@/services/contracts/keywordClustering';
import { readJsonRecord } from '@/services/storageContracts';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Layers3, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToolsStore } from '@/stores/toolsStore';
import { DataForSEOClient, resolveDataForSeoMarket, dataForSeoLanguage, dataForSeoLocation, dataForSeoMarket } from '@/services/dataforseo';
import { DataForSeoLanguagePicker, DataForSeoLocationPicker } from '@/components/DataForSEO/DataForSeoPickers';
import { clusterKeywordsBySerpOverlap, getSerpSnapshot, KeywordClusteringResult } from '@/services/keywordClustering';
import { readStorage, writeJsonStorage, writeStorage } from '@/services/storage';
import { appLocale } from '@/services/localeFormat';
import { MAX_EMBEDDING_KEYWORDS } from '@/services/embeddingClustering';
import { EmbeddingClusteringPanel } from './embeddingClustering/EmbeddingClusteringPanel';
import { ClusteringMethodSwitch, loadMethod, methodKey, type ClusteringMethod } from './embeddingClustering/ClusteringMethodSwitch';

interface ClusteringSession {
  input: string;
  country: string;
  language: string;
  minSharedUrls: number;
  result: KeywordClusteringResult | null;
}

const DEFAULT_SESSION: ClusteringSession = { input: '', country: 'PL', language: 'pl', minSharedUrls: 3, result: null };
const MAX_KEYWORDS = 50;
const sessionKey = (projectId: string) => `seomi_keyword_clustering_${projectId}`;

const loadSession = (projectId: string | null): ClusteringSession => {
  const defaults = { ...DEFAULT_SESSION, country: useToolsStore.getState().keywordCountry, language: useToolsStore.getState().keywordLanguage };
  if (!projectId) return defaults;
  try {
    const saved = readJsonRecord(sessionKey(projectId));
    if (!saved || typeof saved !== 'object') return defaults;
    const parsedResult = keywordClusteringResultSchema.safeParse(saved.result);
    // Keep the input so an obsolete saved market cannot erase the user's list.
    const sharedCountry = readStorage(`seomi_project_${projectId}_dataforseo_market_v1`);
    const market = resolveDataForSeoMarket(sharedCountry || (typeof saved.country === 'string' ? saved.country : defaults.country));
    const country = market?.code || '';
    return {
      input: typeof saved.input === 'string' ? saved.input : '',
      country,
      language: market ? dataForSeoLanguage(market.code, sharedCountry ? defaults.language : (typeof saved.language === 'string' ? saved.language : defaults.language)) : '',
      minSharedUrls: Number.isInteger(saved.minSharedUrls) && Number(saved.minSharedUrls) > 0 ? Number(saved.minSharedUrls) : 3,
      result: (!sharedCountry || saved.country === sharedCountry) && parsedResult.success ? parsedResult.data : null,
    };
  } catch {
    return defaults;
  }
};

const hasSerpResult = (projectId: string): boolean => Boolean(loadSession(projectId).result);

const parseKeywords = (input: string) => {
  const seen = new Set<string>();
  return input.split(/\r?\n/).map((keyword) => keyword.trim()).filter((keyword) => {
    const normalized = keyword.toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export const KeywordClustering: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const credentials = useSettingsStore((state) => state.dataForSeoCredentials);
  const currentResearch = useToolsStore((state) => state.keywordResults);
  const savedKeywords = useToolsStore((state) => state.savedKeywords);
  const [session, setSession] = useState<ClusteringSession>(() => loadSession(activeProjectId));
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<ClusteringMethod>(() => loadMethod(activeProjectId, hasSerpResult));
  const changeMethod = (value: ClusteringMethod) => {
    setMethod(value);
    setError(null);
    if (activeProjectId) writeStorage(methodKey(activeProjectId), value);
  };

  useEffect(() => {
    setSession(loadSession(activeProjectId));
    setMethod(loadMethod(activeProjectId, hasSerpResult));
    setIsRunning(false);
    setError(null);
    setProgress(0);
  }, [activeProjectId]);

  const keywords = useMemo(() => parseKeywords(session.input), [session.input]);
  const updateSession = (patch: Partial<ClusteringSession>) => {
    setSession((current) => {
      const next = { ...current, ...patch };
      if (activeProjectId) {
        writeJsonStorage(sessionKey(activeProjectId), next);
      }
      return next;
    });
  };

  const appendKeywords = (values: string[]) => {
    const merged = [...keywords];
    const seen = new Set(merged.map((keyword) => keyword.toLocaleLowerCase()));
    for (const value of values) {
      const normalized = value.trim();
      if (normalized && !seen.has(normalized.toLocaleLowerCase())) {
        merged.push(normalized);
        seen.add(normalized.toLocaleLowerCase());
      }
    }
    updateSession({ input: merged.slice(0, method === 'serp' ? MAX_KEYWORDS : MAX_EMBEDDING_KEYWORDS).join('\n') });
  };

  const runClustering = async () => {
    if (!activeProjectId) return setError(t('keywordClusteringUi.selectProjectError'));
    if (keywords.length < 2) return setError(t('keywordClusteringUi.minimumKeywordsError'));
    if (keywords.length > MAX_KEYWORDS) return setError(t('keywordClusteringUi.maximumKeywordsError', { count: MAX_KEYWORDS }));
    if (!credentials.login || !credentials.password) return setError(t('keywordClusteringUi.credentialsError'));

    if (!resolveDataForSeoMarket(session.country)) return setError(t('runtimeErrors.dataforseo.marketRequired'));
    const targetProjectId = activeProjectId;
    const selectedLanguage = dataForSeoLanguage(session.country, session.language);
    const client = new DataForSEOClient(credentials.login, credentials.password);
    setIsRunning(true);
    setError(null);
    setProgress(0);
    let completed = 0;
    try {
      const snapshots = [...(session.result?.snapshots || [])].filter((item) => keywords.includes(item.keyword)).map((item) => ({ ...item, urls: item.urls.map((url) => /^https?:\/\//.test(url) ? url : `https://${url}`) }));
      const pending = keywords.filter((keyword) => !snapshots.some((item) => item.keyword === keyword));
      for (const keyword of pending) {

        // One request already in flight cannot be recalled by fetch here, but
        // switching projects must prevent every later billable SERP request.
        if (useProjectStore.getState().activeProjectId !== targetProjectId) return;
        const rows = await client.getSerpCompetitors(keyword, dataForSeoLocation(session.country), selectedLanguage, true);
        if (useProjectStore.getState().activeProjectId !== targetProjectId) return;
        snapshots.push(getSerpSnapshot(keyword, rows));
        completed = snapshots.length;
        const partialResult = clusterKeywordsBySerpOverlap(snapshots, session.minSharedUrls);
        const partialSession = { ...session, language: selectedLanguage, result: partialResult };
        setSession(partialSession);
        writeJsonStorage(sessionKey(targetProjectId), partialSession);
        setProgress(completed);
      }
      const result = clusterKeywordsBySerpOverlap(snapshots, session.minSharedUrls);
      if (useProjectStore.getState().activeProjectId === targetProjectId) {
        const next = { ...session, language: selectedLanguage, result };
        setSession(next);
        writeJsonStorage(sessionKey(targetProjectId), next);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t('keywordClusteringUi.fetchError');
      if (useProjectStore.getState().activeProjectId === targetProjectId) {
        setError(t('keywordClusteringUi.interrupted', { completed, total: keywords.length, message }));
      }
    } finally {
      if (useProjectStore.getState().activeProjectId === targetProjectId) setIsRunning(false);
    }
  };

  const changeCountry = (country: string) => {
    const market = dataForSeoMarket(country);
    const language = dataForSeoLanguage(market.code, session.language);
    useToolsStore.getState().setKeywordCountry(market.code);
    updateSession({ country: market.code, language, result: null });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
          <Layers3 className="h-3.5 w-3.5" /> {t('keywordClusteringUi.badge')}
        </div>
        <h1 className="text-2xl font-bold text-white">{t('keywordClusteringUi.title')}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{t('keywordClusteringUi.description')}</p>
      </header>

      <ClusteringMethodSwitch method={method} disabled={isRunning} onChange={changeMethod} />

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="cluster-keywords" className="text-sm font-semibold text-slate-100">{t('keywordClusteringUi.keywordsLabel')}</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => appendKeywords(currentResearch.map((item) => item.keyword))} disabled={!currentResearch.length || isRunning} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-emerald-500/50 hover:text-white disabled:opacity-50">
              <Plus className="h-3.5 w-3.5" /> {t('keywordClusteringUi.addFromResearch')}
            </button>
            <button type="button" onClick={() => appendKeywords(savedKeywords.map((item) => item.keyword))} disabled={!savedKeywords.length || isRunning} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-emerald-500/50 hover:text-white disabled:opacity-50">
              <Plus className="h-3.5 w-3.5" /> {t('keywordClusteringUi.addSaved')}
            </button>
          </div>
        </div>
        <textarea id="cluster-keywords" value={session.input} onChange={(event) => updateSession({ input: event.target.value, result: null })} disabled={isRunning} rows={8} placeholder={t('keywordClusteringUi.placeholder')} className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500 disabled:opacity-70" />
        {method === 'serp' && (<>
        <p className="text-xs text-amber-200">{t('dataforseo.paidRequests', { count: keywords.filter((keyword) => !session.result?.snapshots.some((item) => item.keyword === keyword)).length })}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs text-slate-400">{t('keywordClusteringUi.location')}
            <DataForSeoLocationPicker
              value={session.country}
              disabled={isRunning}
              onChange={changeCountry}
              ariaLabel={t('dataforseo.locationLabel')}
              placeholder={t('dataforseo.locationLabel')}
              className="min-w-56"
            />
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">{t('keywordClusteringUi.language')}
            <DataForSeoLanguagePicker
              value={session.language}
              market={resolveDataForSeoMarket(session.country) || undefined}
              disabled={isRunning}
              onChange={(language) => { useToolsStore.getState().setKeywordLanguage(language); updateSession({ language, result: null }); }}
              ariaLabel={t('dataforseo.languageLabel')}
              placeholder={t('dataforseo.languageLabel')}
              className="min-w-48"
            />
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">{t('keywordClusteringUi.sharedUrls')}
            <input type="number" min={1} max={10} step={1} value={session.minSharedUrls} disabled={isRunning} onChange={(event) => updateSession({ minSharedUrls: Math.max(1, Math.min(10, Number.parseInt(event.target.value, 10) || 1)), result: null })} className="w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500" />
          </label>
          <div className="ml-auto text-xs text-slate-500">{t('keywordClusteringUi.keywordLimit', { current: keywords.length, max: MAX_KEYWORDS })}</div>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p>{t('keywordClusteringUi.costNotice')}</p>
        </div>
        {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void runClustering()} disabled={isRunning || keywords.length < 2 || keywords.length > MAX_KEYWORDS} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isRunning ? t('keywordClusteringUi.fetching', { current: progress, total: keywords.length }) : t('keywordClusteringUi.run')}
          </button>
          {!credentials.login || !credentials.password ? <span className="text-xs text-amber-300">{t('keywordClusteringUi.credentialsHint')}</span> : null}
        </div>
        </>)}
      </section>

      {method === 'embeddings' && <EmbeddingClusteringPanel projectId={activeProjectId} keywords={keywords} />}

      {method === 'serp' && session.result && (
        <section className="space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-white">{t('keywordClusteringUi.resultTitle')}</h2>
            <span className="text-xs text-slate-500">{t('keywordClusteringUi.resultMeta', { count: session.result.snapshots.length, threshold: session.result.minSharedUrls, date: new Date(session.result.analyzedAt).toLocaleString(appLocale()) })}</span>
          </div>
          {session.result.clusters.length ? session.result.clusters.map((cluster, index) => (
            <article key={cluster.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-emerald-300">{t('keywordClusteringUi.cluster', { index: index + 1 })} <span className="ml-1 text-xs font-normal text-slate-400">{t('keywordClusteringUi.phraseCount', { count: cluster.keywords.length })}</span></h3>
                <span className="text-xs text-slate-500">{t('keywordClusteringUi.overlap')}</span>
              </div>
              <ul className="space-y-3">
                {cluster.pairOverlaps.map((pair) => (
                  <li key={`${pair.keywordA}-${pair.keywordB}`} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-200"><span>{pair.keywordA}</span><span className="text-slate-600">↔</span><span>{pair.keywordB}</span><span className="ml-auto text-xs text-emerald-300">{t('keywordClusteringUi.sharedUrlCount', { count: pair.sharedUrls.length })}</span></div>
                    <ul className="space-y-1">
                      {pair.sharedUrls.map((url) => <li key={url} className="truncate text-xs text-slate-500">{url}</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            </article>
          )) : <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">{t('keywordClusteringUi.noClusters')}</p>}
          {session.result.unclusteredKeywords.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-300">{t('keywordClusteringUi.unclustered', { count: session.result.unclusteredKeywords.length })}</h3>
              <div className="flex flex-wrap gap-2">{session.result.unclusteredKeywords.map((keyword) => <span key={keyword} className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400"><X className="h-3 w-3" />{keyword}</span>)}</div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
