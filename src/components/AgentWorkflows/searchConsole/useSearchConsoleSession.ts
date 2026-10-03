import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import type { GscPerformanceFilters } from '@/types';
import { compareGscSnapshots, findGscStrikingDistanceQueries, latestCompleteGscDateRange,
  readGscSnapshots, saveGscSnapshot, snapshotGscPerformance, validateGscDateRange,
  type GscDateRange, type GscPerformanceSnapshot } from '@/services/gscPerformanceTracker';

export function useSearchConsoleSession() {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const isGscConnected = useToolsStore((s) => s.isGscConnected);
  const gscClientId = useToolsStore((s) => s.gscClientId);
  const gscClientSecret = useToolsStore((s) => s.gscClientSecret);
  const gscProperties = useToolsStore((s) => s.gscProperties);
  const gscProperty = useToolsStore((s) => s.gscProperty);
  const gscFilters = useToolsStore((s) => s.gscFilters || {});
  const gscData = useToolsStore((s) => s.gscData);
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
    if (gscClientId && !isGscConnected) void resumeGsc();
  }, [activeProjectId, gscClientId, gscClientSecret, gscProperty, isGscConnected]);

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
  const updateFilter = (patch: GscPerformanceFilters) => setGscFilters({ ...gscFilters, ...patch });
  const handleSaveSnapshot = () => {
    if (!activeProjectId || !gscData || gscData.site_url !== gscProperty) return;
    try {
      const result = saveGscSnapshot(activeProjectId, gscData);
      setSnapshots(result.snapshots.filter((snapshot) => snapshot.site_url === gscProperty));
      setBaselineId((current) => current || result.snapshots.find((snapshot) => snapshot.id !== result.snapshot.id)?.id || '');
      setTrackerMessage(t('searchConsole.snapshotSaved', { start: result.snapshot.start_date, end: result.snapshot.end_date }));
    } catch (error) {
      setTrackerMessage(error instanceof Error ? error.message : t('searchConsole.snapshotSaveError'));
    }
  };

  const currentSnapshot = gscData && gscData.site_url === gscProperty ? snapshotGscPerformance(gscData) : null;
  const baselineSnapshot = snapshots.find((snapshot) => snapshot.id === baselineId) || null;
  const comparison = baselineSnapshot && currentSnapshot ? compareGscSnapshots(baselineSnapshot, currentSnapshot) : null;
  const strikingDistance = gscData ? findGscStrikingDistanceQueries(currentSnapshot || snapshotGscPerformance(gscData)) : [];
  const snapshotScopeLabel = (filters?: GscPerformanceFilters) => {
    const values = [filters?.search_type, filters?.device, filters?.country?.toUpperCase()].filter(Boolean);
    return values.length ? ` · ${values.join(' · ')}` : ` · ${t('searchConsole.fullScope')}`;
  };

  return { t, activeProjectId, isGscConnected, gscClientId, gscClientSecret, gscProperties, gscProperty, gscFilters, gscData, gscInspectionResult, isGscLoading, gscError, resumeGsc, connectGsc, disconnectGsc, setGscProperty, setGscFilters, refreshGscData, inspectGscUrl, dateRangeError, handleConnect, handleInspect, handleRefresh, updateFilter, handleSaveSnapshot, currentSnapshot, baselineSnapshot, comparison, strikingDistance, snapshotScopeLabel, inputClientId, setInputClientId, inputClientSecret, setInputClientSecret, inspectUrl, setInspectUrl, dateRange, setDateRange, snapshots, setSnapshots, baselineId, setBaselineId, trackerMessage, setTrackerMessage };
}
export type SearchConsoleSession = ReturnType<typeof useSearchConsoleSession>;
