import { useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToolsStore } from '@/stores/toolsStore';
import {
  DataForSEOClient,
  resolveDataForSeoMarket,
  dataForSeoLanguage,
  dataForSeoLocation,
  dataForSeoMarket,
} from '@/services/dataforseo';
import { clusterKeywordsBySerpOverlap, getSerpSnapshot } from '@/services/keywordClustering';
import { writeJsonStorage } from '@/services/storage';
import { type ClusteringSession, MAX_KEYWORDS, parseKeywords, sessionKey } from './keywordClusteringTypes';
import { loadSession } from './keywordClusteringStorage';

export function useKeywordClusteringSession(t: TFunction) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const credentials = useSettingsStore((state) => state.dataForSeoCredentials);
  const currentResearch = useToolsStore((state) => state.keywordResults);
  const savedKeywords = useToolsStore((state) => state.savedKeywords);

  const [session, setSession] = useState<ClusteringSession>(() => loadSession(activeProjectId));
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(loadSession(activeProjectId));
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
    updateSession({ input: merged.slice(0, MAX_KEYWORDS).join('\n') });
  };

  const changeCountry = (country: string) => {
    const market = dataForSeoMarket(country);
    const language = dataForSeoLanguage(market.code, session.language);
    useToolsStore.getState().setKeywordCountry(market.code);
    updateSession({ country: market.code, language, result: null });
  };

  const runClustering = async () => {
    if (!activeProjectId) return setError(t('keywordClusteringUi.selectProjectError'));
    if (keywords.length < 2) return setError(t('keywordClusteringUi.minimumKeywordsError'));
    if (keywords.length > MAX_KEYWORDS)
      return setError(t('keywordClusteringUi.maximumKeywordsError', { count: MAX_KEYWORDS }));
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
      const snapshots = [...(session.result?.snapshots || [])]
        .filter((item) => keywords.includes(item.keyword))
        .map((item) => ({
          ...item,
          urls: item.urls.map((url) => (/^https?:\/\//.test(url) ? url : `https://${url}`)),
        }));
      const pending = keywords.filter((keyword) => !snapshots.some((item) => item.keyword === keyword));
      for (const keyword of pending) {
        if (useProjectStore.getState().activeProjectId !== targetProjectId) return;
        const rows = await client.getSerpCompetitors(
          keyword,
          dataForSeoLocation(session.country),
          selectedLanguage,
          true,
        );
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

  return {
    session,
    keywords,
    credentials,
    currentResearch,
    savedKeywords,
    isRunning,
    progress,
    error,
    updateSession,
    appendKeywords,
    changeCountry,
    runClustering,
  };
}
