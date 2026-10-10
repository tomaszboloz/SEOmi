import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import {
  clearTrendingNow,
  fetchTrendingNow,
  importTrendingNow,
  MAX_TRENDING_PAYLOAD_BYTES,
  readTrendingNow,
  saveTrendingNow,
  type TrendingSnapshot,
} from '@/services/trendingNow';
import { fileFormat, messageFor, readFile } from './trendingNowSessionHelpers';

export const useTrendingNowSession = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const [geo, setGeoState] = useState('PL');
  const [snapshot, setSnapshot] = useState<TrendingSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operationRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; operationRef.current += 1; };
  }, []);

  useEffect(() => {
    operationRef.current += 1;
    setIsLoading(false);
    setError(null);
    if (!activeProjectId) {
      setSnapshot(null);
      setGeoState('PL');
      return;
    }
    const loaded = readTrendingNow(activeProjectId);
    setSnapshot(loaded);
    setGeoState(loaded?.geo || 'PL');
  }, [activeProjectId]);

  const isCurrent = (projectId: string, operation: number) =>
    mountedRef.current && operationRef.current === operation && useProjectStore.getState().activeProjectId === projectId;

  const persist = (projectId: string, next: TrendingSnapshot) => {
    if (!saveTrendingNow(projectId, next)) {
      setError(t('trendingNowUi.storageUnavailable'));
    }
  };

  const refresh = useCallback(async () => {
    const projectId = activeProjectId;
    if (!projectId) {
      setError(t('trendingNowUi.selectProjectError'));
      return;
    }
    const operation = ++operationRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchTrendingNow(projectId, geo);
      if (!isCurrent(projectId, operation)) return;
      setSnapshot(next);
      setGeoState(next.geo);
      persist(projectId, next);
    } catch (caught) {
      if (isCurrent(projectId, operation)) setError(messageFor(caught, t('trendingNowUi.fetchError')));
    } finally {
      if (isCurrent(projectId, operation)) setIsLoading(false);
    }
  }, [activeProjectId, geo, t]);

  const importFile = useCallback(async (file: File) => {
    const projectId = activeProjectId;
    if (!projectId) {
      setError(t('trendingNowUi.selectProjectError'));
      return;
    }
    if (file.size > MAX_TRENDING_PAYLOAD_BYTES) {
      setError(t('trendingNowUi.payloadTooLarge'));
      return;
    }
    const format = fileFormat(file);
    if (!format) {
      setError(t('trendingNowUi.unsupportedImport'));
      return;
    }
    const operation = ++operationRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const next = importTrendingNow(projectId, await readFile(file), format, geo);
      if (!isCurrent(projectId, operation)) return;
      setSnapshot(next);
      setGeoState(next.geo);
      persist(projectId, next);
    } catch (caught) {
      if (isCurrent(projectId, operation)) setError(messageFor(caught, t('trendingNowUi.importError')));
    } finally {
      if (isCurrent(projectId, operation)) setIsLoading(false);
    }
  }, [activeProjectId, geo, t]);

  const setGeo = useCallback((nextGeo: string) => {
    operationRef.current += 1;
    setIsLoading(false);
    setError(null);
    setGeoState(nextGeo);
  }, []);

  const clear = useCallback(() => {
    operationRef.current += 1;
    setIsLoading(false);
    if (!activeProjectId) {
      setError(t('trendingNowUi.selectProjectError'));
      return;
    }
    setError(null);
    if (!clearTrendingNow(activeProjectId)) {
      setError(t('trendingNowUi.storageUnavailable'));
      return;
    }
    setSnapshot(null);
  }, [activeProjectId, t]);

  return {
    activeProjectId,
    geo,
    setGeo,
    snapshot,
    isLoading,
    error,
    refresh,
    importFile,
    clear,
    maxPayloadBytes: MAX_TRENDING_PAYLOAD_BYTES,
  };
};
