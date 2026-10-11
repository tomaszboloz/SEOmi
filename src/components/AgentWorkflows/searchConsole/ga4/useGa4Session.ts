import { useCallback, useEffect, useRef, useState } from 'react';
import { joinGa4Evidence } from '@/services/ga4/join';
import { matchGa4Property } from '@/services/ga4/matching';
import { validateGa4DateRange } from '@/services/ga4/contracts';
import { connectGoogleAnalytics, fetchGoogleAnalyticsPerformance, listGoogleAnalyticsProperties } from '@/services/ga4/transport';
import type { Ga4DateRange, Ga4Discovery, Ga4Report } from '@/types/ga4';
import type { Ga4PanelProps, Ga4SessionState } from './types';

const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);

export function useGa4Session(input: Ga4PanelProps): Ga4SessionState {
  const { session, projectRootUrl, crawlResult } = input;
  const projectId = session.activeProjectId;
  const clientId = session.gscClientId.trim();
  const gscData = session.gscData;
  const dateRange: Ga4DateRange = gscData?.start_date && gscData.end_date
    ? { startDate: gscData.start_date, endDate: gscData.end_date } : session.dateRange;
  const [analyticsConnected, setAnalyticsConnected] = useState(false);
  const [discovery, setDiscovery] = useState<Ga4Discovery | null>(null);
  const [report, setReport] = useState<Ga4Report | null>(null);
  const [joined, setJoined] = useState<ReturnType<typeof joinGa4Evidence> | null>(null);
  const [loading, setLoading] = useState<Ga4SessionState['loading']>('idle');
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const projectRef = useRef(projectId);
  projectRef.current = projectId;
  const isCurrent = (token: number, owner: string | null): boolean => requestRef.current === token && projectRef.current === owner;
  const matchedProperty = discovery?.property && matchGa4Property([discovery.property], projectRootUrl) || null;
  const dateRangeError = validateGa4DateRange(dateRange);

  useEffect(() => {
    requestRef.current += 1;
    setAnalyticsConnected(false);
    setDiscovery(null);
    setReport(null);
    setJoined(null);
    setLoading('idle');
    setError(null);
  }, [projectId, clientId, projectRootUrl]);

  useEffect(() => {
    requestRef.current += 1;
    setReport(null);
    setJoined(null);
  }, [projectId, dateRange.startDate, dateRange.endDate]);

  const loadDiscovery = useCallback(async () => {
    if (!projectId || !clientId || !projectRootUrl) {
      setError('Google Analytics requires an active project, client ID and project URL.');
      return;
    }
    const token = ++requestRef.current;
    setLoading('listing');
    setError(null);
    try {
      const result = await listGoogleAnalyticsProperties({ projectId, clientId, siteUrl: projectRootUrl });
      if (!isCurrent(token, projectId)) return;
      setDiscovery(result);
      setReport(null);
      setJoined(null);
    } catch (cause) {
      if (isCurrent(token, projectId)) setError(messageOf(cause));
    } finally {
      if (isCurrent(token, projectId)) setLoading('idle');
    }
  }, [clientId, projectId, projectRootUrl]);

  const connectAnalytics = useCallback(async (clientSecret?: string) => {
    if (!projectId || !clientId) {
      setError('Connect Search Console before authorizing Google Analytics.');
      return;
    }
    const token = ++requestRef.current;
    setLoading('connecting');
    setError(null);
    try {
      await connectGoogleAnalytics({ projectId, clientId, ...(clientSecret?.trim() ? { clientSecret: clientSecret.trim() } : {}) });
      if (!isCurrent(token, projectId)) return;
      setAnalyticsConnected(true);
      await loadDiscovery();
    } catch (cause) {
      if (isCurrent(token, projectId)) setError(messageOf(cause));
      if (isCurrent(token, projectId)) setLoading('idle');
    }
  }, [clientId, loadDiscovery, projectId]);

  const loadReport = useCallback(async () => {
    if (!projectId || !clientId || !projectRootUrl || !matchedProperty) {
      setError('No Google Analytics property matches the active project URL.');
      return;
    }
    if (dateRangeError) {
      setError(dateRangeError);
      return;
    }
    const token = ++requestRef.current;
    setLoading('reporting');
    setError(null);
    try {
      const snapshot = await fetchGoogleAnalyticsPerformance({ projectId, clientId, siteUrl: projectRootUrl, startDate: dateRange.startDate, endDate: dateRange.endDate });
      if (!isCurrent(token, projectId)) return;
      const nextReport = snapshot.report;
      setReport(nextReport);
      setJoined(nextReport ? joinGa4Evidence({ report: nextReport, gscData, crawlResult, projectRootUrl }) : null);
      setDiscovery(snapshot.discovery);
    } catch (cause) {
      if (isCurrent(token, projectId)) setError(messageOf(cause));
    } finally {
      if (isCurrent(token, projectId)) setLoading('idle');
    }
  }, [clientId, crawlResult, dateRange.endDate, dateRange.startDate, dateRangeError, gscData, matchedProperty, projectId, projectRootUrl]);

  return {
    analyticsConnected,
    discovery,
    matchedProperties: matchedProperty ? [matchedProperty] : [],
    selectedProperty: matchedProperty,
    report,
    joined,
    loading,
    error,
    dateRange,
    connectAnalytics,
    refreshProperties: loadDiscovery,
    loadReport,
  };
}
