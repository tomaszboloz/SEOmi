import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import type { GscPerformanceFilters } from '@/types';
import { monitorGscSnapshots } from '@/services/monitoringAlerts';
import { compareGscSnapshots, findGscStrikingDistanceQueries, latestCompleteGscDateRange,
  readGscSnapshots, saveGscSnapshot, snapshotGscPerformance, validateGscDateRange,
  type GscDateRange, type GscPerformanceSnapshot } from '@/services/gscPerformanceTracker';

export function useSearchConsoleSession() {
  const { t, i18n } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const isGscConnected = useToolsStore((s) => s.isGscConnected);
  const gscHydratedProjectId = useToolsStore((s) => s.gscHydratedProjectId);
  const gscClientId = useToolsStore((s) => s.gscClientId);
  const gscClientSecret = useToolsStore((s) => s.gscClientSecret);
  const gscProperties = useToolsStore((s) => s.gscProperties);
  const gscProperty = useToolsStore((s) => s.gscProperty);
  const gscFilters = useToolsStore((s) => s.gscFilters || {});
  const gscData = useToolsStore((s) => s.gscData);
  const gscDataFetchedAt = useToolsStore((s) => s.gscDataFetchedAt);
  const gscInspectionResult = useToolsStore((s) => s.gscInspectionResult);
  const isGscLoading = useToolsStore((s) => s.isGscLoading);
  const gscError = useToolsStore((s) => s.gscError);
  const resumeGsc = useToolsStore((s) => s.resumeGsc);
  const connectGsc = useToolsStore((s) => s.connectGsc);
  const disconnectGsc = useToolsStore((s) => s.disconnectGsc);
  const setGscProperty = useToolsStore((s) => s.setGscProperty);
  const setGscFilters = useToolsStore((s) => s.setGscFilters);
  const refreshGscData = useToolsStore((s) => s.refreshGscData);
  const inspectGscUrl = useToolsStore((s) => s.inspectGscUrl);

  const [inputClientId, setInputClientId] = useState(gscClientId);
  const [inputClientSecret, setInputClientSecret] = useState(gscClientSecret);
  const [inspectUrl, setInspectUrl] = useState('');
  const [dateRange, setDateRange] = useState<GscDateRange>(() => latestCompleteGscDateRange());
  const [snapshots, setSnapshots] = useState<GscPerformanceSnapshot[]>([]);
  const [baselineId, setBaselineId] = useState('');
  const [trackerMessage, setTrackerMessage] = useState('');
  const dateRangeError = validateGscDateRange(dateRange);
  const isGscScopeReady = Boolean(activeProjectId) && gscHydratedProjectId === activeProjectId;
  useEffect(() => {
    setInputClientId(gscClientId);
    setInputClientSecret(gscClientSecret);
    if (activeProjectId) {
      const loaded = readGscSnapshots(activeProjectId).filter((snapshot) => !gscProperty || snapshot.site_url === gscProperty);
      setSnapshots(loaded);
      setBaselineId(loaded[0]?.id || '');
    } else {
      setSnapshots([]);
      setBaselineId('');
    }
    if (isGscScopeReady && gscClientId && !isGscConnected) void resumeGsc();
  }, [activeProjectId, gscClientId, gscClientSecret, gscProperty, isGscConnected, isGscScopeReady]);

  useEffect(() => {
    setInspectUrl('');
    setDateRange(latestCompleteGscDateRange());
    setTrackerMessage('');
  }, [activeProjectId]);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputClientId.trim()) return;
    void connectGsc(inputClientId.trim(), inputClientSecret.trim());
  };

  const handleInspect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectUrl.trim()) return;
    void inspectGscUrl(inspectUrl);
  };

  const handleRefresh = () => {
    if (!dateRangeError) void refreshGscData(dateRange, gscFilters);
  };
  // First visit with a connected property and nothing remembered: fetch once instead of showing an empty view.
  const autoFetched = useRef('');
  useEffect(() => {
    const scope = `${activeProjectId}|${gscProperty}|${JSON.stringify(gscFilters)}`;
    if (!isGscScopeReady || !isGscConnected || !gscProperty || gscData || isGscLoading || gscError || dateRangeError || autoFetched.current === scope) return;
    autoFetched.current = scope;
    handleRefresh();
  }, [isGscScopeReady, isGscConnected, gscProperty, gscData, isGscLoading, gscError, dateRangeError, activeProjectId, gscFilters]);
  const updateFilter = (patch: GscPerformanceFilters) => setGscFilters({ ...gscFilters, ...patch });
  const handleSaveSnapshot = () => {
    if (!isGscScopeReady || !activeProjectId || !gscData || gscData.site_url !== gscProperty) return;
    try {
      const result = saveGscSnapshot(activeProjectId, gscData);
      if (baselineSnapshot) void monitorGscSnapshots(activeProjectId, baselineSnapshot, result.snapshot);
      setSnapshots(result.snapshots.filter((snapshot) => snapshot.site_url === gscProperty));
      setBaselineId((current) => current || result.snapshots.find((snapshot) => snapshot.id !== result.snapshot.id)?.id || '');
      setTrackerMessage(t('searchConsole.snapshotSaved', { start: result.snapshot.start_date, end: result.snapshot.end_date }));
    } catch (error) {
      setTrackerMessage(error instanceof Error ? error.message : t('searchConsole.snapshotSaveError'));
    }
  };

  const scopedGscProperty = isGscScopeReady ? gscProperty : '';
  const scopedGscData = isGscScopeReady && (!gscData || gscData.site_url === scopedGscProperty) ? gscData : null;
  const currentSnapshot = useMemo(() => scopedGscData && scopedGscData.site_url === scopedGscProperty ? snapshotGscPerformance(scopedGscData) : null, [scopedGscData, scopedGscProperty]);
  const baselineSnapshot = isGscScopeReady ? snapshots.find((snapshot) => snapshot.id === baselineId) || null : null;
  const comparison = baselineSnapshot && currentSnapshot ? compareGscSnapshots(baselineSnapshot, currentSnapshot) : null;
  const strikingDistance = scopedGscData ? findGscStrikingDistanceQueries(currentSnapshot || snapshotGscPerformance(scopedGscData)) : [];
  const snapshotScopeLabel = (filters?: GscPerformanceFilters) => {
    const values = [filters?.search_type, filters?.device, filters?.country?.toUpperCase()].filter(Boolean);
    return values.length ? ` · ${values.join(' · ')}` : ` · ${t('searchConsole.fullScope')}`;
  };

  return { t, i18n, activeProjectId, isGscScopeReady, gscHydratedProjectId, isGscConnected: isGscScopeReady && isGscConnected,
    gscClientId, gscClientSecret, gscProperties: isGscScopeReady ? gscProperties : [], gscProperty: scopedGscProperty,
    gscFilters: isGscScopeReady ? gscFilters : {}, gscData: scopedGscData, gscDataFetchedAt: scopedGscData ? gscDataFetchedAt : null,
    gscInspectionResult: isGscScopeReady ? gscInspectionResult : null, isGscLoading, gscError: isGscScopeReady ? gscError : null,
    resumeGsc, connectGsc, disconnectGsc, setGscProperty, setGscFilters, refreshGscData, inspectGscUrl, dateRangeError, handleConnect,
    handleInspect, handleRefresh, updateFilter, handleSaveSnapshot, currentSnapshot, baselineSnapshot, comparison, strikingDistance,
    snapshotScopeLabel, inputClientId, setInputClientId, inputClientSecret, setInputClientSecret, inspectUrl, setInspectUrl, dateRange,
    setDateRange, snapshots: isGscScopeReady ? snapshots : [], setSnapshots, baselineId, setBaselineId, trackerMessage, setTrackerMessage };
}
export type SearchConsoleSession = ReturnType<typeof useSearchConsoleSession>;
