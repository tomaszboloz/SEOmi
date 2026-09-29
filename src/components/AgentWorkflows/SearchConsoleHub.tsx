import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  MousePointerClick,
  Eye,
  Percent,
  TrendingUp,
  RefreshCw,
  ShieldCheck,
  FileCheck,
  Loader2,
} from 'lucide-react';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import type { GscPerformanceFilters } from '@/types';
import { TrendChart } from '@/components/Charts/TrendChart';
import {
  compareGscSnapshots,
  findGscStrikingDistanceQueries,
  latestCompleteGscDateRange,
  readGscSnapshots,
  saveGscSnapshot,
  snapshotGscPerformance,
  validateGscDateRange,
  type GscDateRange,
  type GscPerformanceSnapshot,
} from '@/services/gscPerformanceTracker';

export const SearchConsoleHub: React.FC = () => {
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {t('searchConsole.badge')}
            </span>
            <span className="text-xs text-slate-400 font-mono">{t('searchConsole.dataBadge')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">{t('searchConsole.title')}</h1>
          <p className="text-sm text-slate-400">
            {t('searchConsole.description')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isGscConnected ? (
            <>
              <button
                onClick={handleRefresh}
                disabled={isGscLoading || !gscProperty || Boolean(dateRangeError)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isGscLoading ? 'animate-spin' : ''}`} />
                <span>{t('searchConsole.refresh')}</span>
              </button>
              <button
                onClick={() => void disconnectGsc()}
                disabled={isGscLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 transition disabled:opacity-50"
              >
                {t('searchConsole.disconnect')}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Connect Property Form */}
      {!isGscConnected ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-white font-bold text-base">
            <Globe className="w-5 h-5 text-emerald-400" />
            <span>{t('searchConsole.connectTitle')}</span>
          </div>
          <p className="text-xs text-slate-400">
            {t('searchConsole.connectDescription')}
          </p>

          <form onSubmit={handleConnect} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              value={inputClientId}
              onChange={(e) => setInputClientId(e.target.value)}
              placeholder={t('searchConsole.clientIdPlaceholder')}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <input
              type="password"
              value={inputClientSecret}
              onChange={(e) => setInputClientSecret(e.target.value)}
              placeholder={t('searchConsole.clientSecretPlaceholder')}
              aria-label={t('searchConsole.clientSecretLabel')}
              autoComplete="off"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              disabled={isGscLoading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-950"
            >
              {isGscLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('searchConsole.connecting')}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('searchConsole.authorize')}</span>
                </>
              )}
            </button>
          </form>
          {gscError && <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200">{gscError}</p>}
        </div>
      ) : (
        <div className="space-y-8">
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate-300">{t('searchConsole.startDate')}
                <input aria-label={t('searchConsole.startDateAria')} type="date" value={dateRange.startDate} onChange={(event) => setDateRange((range) => ({ ...range, startDate: event.target.value }))} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-300">{t('searchConsole.endDate')}
                <input aria-label={t('searchConsole.endDateAria')} type="date" value={dateRange.endDate} onChange={(event) => setDateRange((range) => ({ ...range, endDate: event.target.value }))} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
              </label>
              <span className="text-xs text-slate-500">{t('searchConsole.dataFreshness')}</span>
              <button type="button" onClick={handleSaveSnapshot} disabled={!gscData || !activeProjectId || gscData.site_url !== gscProperty} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 disabled:opacity-40">{t('searchConsole.saveSnapshot')}</button>
            </div>
            <div className="grid gap-3 border-t border-slate-800 pt-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-slate-300">{t('searchConsoleFilters.searchType')}
                <select aria-label={t('searchConsole.searchTypeAria')} value={gscFilters.search_type || ''} onChange={(event) => updateFilter({ search_type: event.target.value ? event.target.value as GscPerformanceFilters['search_type'] : undefined })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
                  <option value="">{t('searchConsoleFilters.allSearchTypes')}</option>
                  <option value="web">{t('searchConsoleFilters.web')}</option>
                  <option value="image">{t('searchConsoleFilters.image')}</option>
                  <option value="video">{t('searchConsoleFilters.video')}</option>
                  <option value="news">{t('searchConsoleFilters.news')}</option>
                  <option value="discover">{t('searchConsoleFilters.discover')}</option>
                  <option value="googleNews">{t('searchConsoleFilters.googleNews')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-300">{t('searchConsoleFilters.device')}
                <select aria-label={t('searchConsole.deviceAria')} value={gscFilters.device || ''} onChange={(event) => updateFilter({ device: event.target.value ? event.target.value as GscPerformanceFilters['device'] : undefined })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
                  <option value="">{t('searchConsoleFilters.allDevices')}</option>
                  <option value="DESKTOP">{t('searchConsoleFilters.desktop')}</option>
                  <option value="MOBILE">{t('searchConsoleFilters.mobile')}</option>
                  <option value="TABLET">{t('searchConsoleFilters.tablet')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-300">{t('searchConsoleFilters.country')}
                <input aria-label={t('searchConsole.countryAria')} inputMode="text" autoCapitalize="characters" maxLength={3} pattern="[A-Za-z]{3}" placeholder={t('searchConsoleFilters.countryPlaceholder')} value={gscFilters.country || ''} onChange={(event) => updateFilter({ country: event.target.value.replace(/[^A-Za-z]/g, '').slice(0, 3).toLowerCase() || undefined })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono uppercase text-slate-100 placeholder:normal-case" />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">{t('searchConsoleFilters.scopeHint')}</p>
            {dateRangeError && <p role="alert" className="text-xs text-rose-300">{dateRangeError}</p>}
            {trackerMessage && <p role="status" className="text-xs text-emerald-300">{trackerMessage}</p>}
          </section>
          {gscProperties.length > 0 ? <label className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <span>{t('searchConsole.property')}</span>
            <select aria-label={t('searchConsole.selectedPropertyAria')} value={gscProperty} onChange={(event) => setGscProperty(event.target.value)} className="min-w-0 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 sm:w-2/3">
              {gscProperties.map((property) => <option key={property.siteUrl} value={property.siteUrl}>{property.siteUrl} · {property.permissionLevel}</option>)}
            </select>
          </label> : <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">{t('searchConsole.noProperties')}</p>}
          {gscError && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">{gscError}</p>}
          {/* Performance Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <MousePointerClick className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('searchConsole.totalClicks')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {gscData?.total_clicks.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-500">{gscData ? `${gscData.start_date} — ${gscData.end_date}` : t('searchConsole.completeDays')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('searchConsole.totalImpressions')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {gscData?.total_impressions.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-500">{t('searchConsole.searchAppearances')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('searchConsole.averageCtr')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">{gscData?.avg_ctr}%</div>
              <span className="text-[11px] text-slate-500">{t('searchConsole.clickThroughRate')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                <span>{t('searchConsole.averagePosition')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">{gscData?.avg_position}</div>
              <span className="text-[11px] text-slate-500">{t('searchConsole.meanSerpRank')}</span>
            </div>
          </div>
          {gscData && <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div><h2 className="font-semibold text-white">{t('searchConsole.dailyTrend')}</h2><p className="text-xs text-slate-400">{t('searchConsole.dailyTrendDescription')}</p>{gscData.daily_may_be_truncated && <p role="note" className="mt-1 text-xs text-amber-300">{t('searchConsole.trendTruncated')}</p>}</div>
            {gscData.daily.length >= 2 ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {([
                { key: 'clicks', title: t('searchConsole.clicks'), invert: false },
                { key: 'impressions', title: t('searchConsole.impressions'), invert: false },
                { key: 'ctr', title: t('searchConsole.ctr'), invert: false },
                { key: 'position', title: t('searchConsole.position'), invert: true },
              ] as const).map(({ key, title, invert }) => <div key={key} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs text-slate-300">{title}</span><span className="text-[10px] text-slate-500">{t('searchConsole.days', { count: gscData.daily.length })}</span></div>
                <TrendChart values={gscData.daily.map((day) => day[key])} label={t('searchConsole.dailyTrendLabel', { metric: title })} invert={invert} />
                <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{gscData.daily[0]?.date}</span><span>{gscData.daily.at(-1)?.date}</span></div>
              </div>)}
            </div> : <p className="text-xs text-slate-500">{t('searchConsole.tooFewPoints')}</p>}
          </section>}
          {gscData && <p role="note" className={`rounded-lg border p-3 text-[11px] leading-5 ${gscData.queries_may_be_truncated || gscData.pages_may_be_truncated ? 'border-amber-500/30 bg-amber-950/20 text-amber-200' : 'border-slate-800 bg-slate-900/40 text-slate-400'}`}>
            {t('searchConsole.analyticsPaging', { max: gscData.max_rows_per_dimension.toLocaleString(), queries: gscData.queries.length.toLocaleString(), pages: gscData.pages.length.toLocaleString(), truncated: gscData.queries_may_be_truncated || gscData.pages_may_be_truncated ? t('searchConsole.analyticsTruncated') : '' })}
          </p>}

          {gscData && <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold text-white">{t('searchConsole.changesTitle')}</h2><p className="text-xs text-slate-400">{t('searchConsole.changesDescription')}</p></div>
              <label className="flex items-center gap-2 text-xs text-slate-300">{t('searchConsole.baselinePeriod')}
                <select aria-label={t('searchConsole.baselineSnapshotAria')} value={baselineId} onChange={(event) => setBaselineId(event.target.value)} className="max-w-64 rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-slate-100">
                  <option value="">{t('searchConsole.chooseSnapshot')}</option>
                  {snapshots.filter((snapshot) => snapshot.id !== currentSnapshot?.id).map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.start_date} — {snapshot.end_date}{snapshotScopeLabel(snapshot.filters)}</option>)}
                </select>
              </label>
            </div>
            {comparison?.compatible ? <>
              <p className={`text-xs ${comparison.uncertainBecauseTruncated ? 'text-amber-300' : 'text-slate-400'}`}>
                {t('searchConsole.comparedRows', { queries: comparison.queryChanges.length, pages: comparison.pageChanges.length })}
              </p>
              {comparison.uncertainBecauseTruncated && <p role="note" className="text-xs text-amber-300">{t('searchConsole.truncatedWarning')}</p>}
              <div className="grid gap-4 lg:grid-cols-2">
                <div><h3 className="mb-2 text-sm font-medium text-white">{t('searchConsole.queryDeclines')}</h3>
                  {comparison.queryChanges.filter((change) => change.potentialDecline).slice(0, 10).map((change) => <div key={change.key} className="flex justify-between gap-3 border-t border-slate-800 py-2 text-xs"><span className="truncate text-slate-200">{change.key}</span><span className="shrink-0 text-rose-300">{change.clicksDeltaPercent === null ? '—' : `${change.clicksDeltaPercent.toFixed(1)}% ${t('searchConsole.clicksDelta')}`}</span></div>)}
                  {!comparison.queryChanges.some((change) => change.potentialDecline) && <p className="text-xs text-slate-500">{t('searchConsole.noDeclines')}</p>}
                </div>
                <div><h3 className="mb-2 text-sm font-medium text-white">{t('searchConsole.strikingDistance')}</h3>
                  {strikingDistance.slice(0, 10).map((query) => <div key={query.query} className="flex justify-between gap-3 border-t border-slate-800 py-2 text-xs"><span className="truncate text-slate-200">{query.query}</span><span className="shrink-0 text-emerald-300">{t('searchConsole.positionShort', { position: query.position.toFixed(1), impressions: query.impressions.toLocaleString() })}</span></div>)}
                  {!strikingDistance.length && <p className="text-xs text-slate-500">{t('searchConsole.noStrikingDistance')}</p>}
                </div>
              </div>
            </> : <p className="text-xs text-slate-500">{comparison?.reason || t('searchConsole.comparisonUnavailable')}</p>}
          </section>}

          {/* Quick URL Inspection */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>{t('searchConsole.urlInspectionTitle')}</span>
            </h3>

            <form onSubmit={handleInspect} className="flex gap-2">
              <input
                type="text"
                value={inspectUrl}
                onChange={(e) => setInspectUrl(e.target.value)}
                aria-label={t('searchConsole.inspectionAria')}
                placeholder={t('searchConsole.inspectionPlaceholder')}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                disabled={isGscLoading || !gscProperty}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition"
              >
                {t('searchConsole.inspectUrl')}
              </button>
            </form>

            {gscInspectionResult && <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] text-emerald-200">{JSON.stringify(gscInspectionResult, null, 2)}</pre>}
            {gscError && <p role="alert" className="text-xs text-rose-300">{gscError}</p>}
          </div>

          {/* Top Search Queries and Top Pages Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Queries */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h3 className="font-bold text-white text-sm">{t('searchConsole.topQueries')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="text-slate-500 uppercase border-b border-slate-800 font-sans">
                    <tr>
                      <th className="pb-2">{t('searchConsole.searchQuery')}</th>
                      <th className="pb-2 text-right">{t('searchConsole.clicksShort')}</th>
                      <th className="pb-2 text-right">{t('searchConsole.impressionsShort')}</th>
                      <th className="pb-2 text-right">{t('searchConsole.ctr')}</th>
                      <th className="pb-2 text-center">{t('searchConsole.positionShortHeader')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {gscData?.queries.map((q, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 font-sans font-medium text-slate-200">{q.query}</td>
                        <td className="py-2.5 text-right text-emerald-400 font-bold">{q.clicks.toLocaleString()}</td>
                        <td className="py-2.5 text-right text-slate-400">{q.impressions.toLocaleString()}</td>
                        <td className="py-2.5 text-right text-slate-300">{q.ctr}%</td>
                        <td className="py-2.5 text-center text-amber-400 font-bold">#{q.position}</td>
                      </tr>
                    ))}
                    {gscData?.queries.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">{t('searchConsole.noQueryRows')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Pages */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h3 className="font-bold text-white text-sm">{t('searchConsole.topPages')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="text-slate-500 uppercase border-b border-slate-800 font-sans">
                    <tr>
                      <th className="pb-2">{t('searchConsole.pageUrl')}</th>
                      <th className="pb-2 text-right">{t('searchConsole.clicksShort')}</th>
                      <th className="pb-2 text-right">{t('searchConsole.impressionsShort')}</th>
                      <th className="pb-2 text-right">{t('searchConsole.ctr')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {gscData?.pages.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 text-slate-200 truncate max-w-[180px]">{p.page}</td>
                        <td className="py-2.5 text-right text-emerald-400 font-bold">{p.clicks.toLocaleString()}</td>
                        <td className="py-2.5 text-right text-slate-400">{p.impressions.toLocaleString()}</td>
                        <td className="py-2.5 text-right text-slate-300">{p.ctr}%</td>
                      </tr>
                    ))}
                    {gscData?.pages.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-slate-500">{t('searchConsole.noPageRows')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
