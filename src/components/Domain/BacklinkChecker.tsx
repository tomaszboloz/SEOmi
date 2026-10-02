import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link2,
  Globe,
  Shield,
  Layers,
  Search,
  Loader2,
  Sparkles,
  BarChart2,
  Download,
} from 'lucide-react';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { downloadBacklinkGapCsv } from '@/services/export';
import { TrendChart } from '@/components/Charts/TrendChart';
import { appLocale } from '@/services/localeFormat';

export const BacklinkChecker: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useProjectStore((s) => s.projects.find((project) => project.id === s.activeProjectId));
  const backlinkQuery = useToolsStore((s) => s.backlinkQuery);
  const backlinkProfile = useToolsStore((s) => s.backlinkProfile);
  const backlinkProfileHistory = useToolsStore((s) => s.backlinkProfileHistory);
  const isLoading = useToolsStore((s) => s.isBacklinkLoading);
  const error = useToolsStore((s) => s.backlinkError);
  const setBacklinkQuery = useToolsStore((s) => s.setBacklinkQuery);
  const analyzeBacklinks = useToolsStore((s) => s.analyzeBacklinks);
  const loadMoreBacklinks = useToolsStore((s) => s.loadMoreBacklinks);
  const loadMoreBacklinkAnchors = useToolsStore((s) => s.loadMoreBacklinkAnchors);
  const backlinkGapCompetitors = useToolsStore((s) => s.backlinkGapCompetitors);
  const backlinkGapIncludeSubdomains = useToolsStore((s) => s.backlinkGapIncludeSubdomains);
  const backlinkGapReport = useToolsStore((s) => s.backlinkGapReport);
  const isBacklinkGapLoading = useToolsStore((s) => s.isBacklinkGapLoading);
  const backlinkGapError = useToolsStore((s) => s.backlinkGapError);
  const setBacklinkGapCompetitors = useToolsStore((s) => s.setBacklinkGapCompetitors);
  const setBacklinkGapIncludeSubdomains = useToolsStore((s) => s.setBacklinkGapIncludeSubdomains);
  const analyzeBacklinkGap = useToolsStore((s) => s.analyzeBacklinkGap);
  const loadMoreBacklinkGap = useToolsStore((s) => s.loadMoreBacklinkGap);

  const [inputTarget, setInputTarget] = useState(backlinkQuery);
  const [competitorInput, setCompetitorInput] = useState(backlinkGapCompetitors.join('\n'));
  const initializedProjectRef = useRef<string | null>(null);
  const parsedCompetitors = competitorInput.split(/[\n,;]+/).map((domain) => domain.trim()).filter(Boolean).slice(0, 19);

  useEffect(() => setCompetitorInput(backlinkGapCompetitors.join('\n')), [backlinkGapCompetitors]);

  useEffect(() => {
    setInputTarget(backlinkQuery);
  }, [activeProjectId, backlinkQuery]);

  // Keep the backlink workflow project-first without overwriting a saved
  // target or a value the user has already entered.
  useEffect(() => {
    const projectRoot = activeProject?.rootUrl?.trim();
    if (!activeProjectId || initializedProjectRef.current === activeProjectId) return;
    initializedProjectRef.current = activeProjectId;
    if (!projectRoot || backlinkQuery.trim()) return;
    setBacklinkQuery(projectRoot);
    setInputTarget(projectRoot);
  }, [activeProject?.rootUrl, activeProjectId, backlinkQuery, setBacklinkQuery]);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTarget.trim()) return;
    setBacklinkQuery(inputTarget.trim());
    analyzeBacklinks(inputTarget.trim());
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {t('domainResearchUi.badge')}
            </span>
            <span className="text-xs text-slate-400 font-mono">{t('backlinkUi.eyebrow')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">{t('backlinkUi.title')}</h1>
          <p className="text-sm text-slate-400">
            {t('backlinkUi.description')}
          </p>
        </div>
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleAnalyze}
        className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row gap-3 shadow-lg"
      >
        <div className="flex-1 relative">
          <Link2 className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={inputTarget}
            onChange={(e) => setInputTarget(e.target.value)}
            placeholder={t('backlinkUi.placeholder')}
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-950"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('backlinkUi.scanning')}</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span>{t('backlinkUi.inspect')}</span>
            </>
          )}
        </button>
      </form>

      <p className="-mt-5 text-[11px] text-slate-500">{t('backlinkUi.costSummary')}</p>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5" aria-labelledby="backlink-gap-title">
        <div>
          <h2 id="backlink-gap-title" className="text-base font-semibold text-white">{t('backlinkUi.gapTitle')}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">{t('backlinkUi.gapDescription')}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="space-y-1.5 text-xs text-slate-300">
            <span>{t('backlinkUi.competitorLabel')}</span>
            <textarea
              aria-label={t('backlinkUi.competitorAria')}
              value={competitorInput}
              onChange={(event) => { const next = event.target.value; setCompetitorInput(next); setBacklinkGapCompetitors(next.split(/[\n,;]+/).map((domain) => domain.trim()).filter(Boolean).slice(0, 19)); }}
              placeholder={t('backlinkUi.competitorPlaceholder')}
              rows={3}
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <div className="flex flex-col items-start justify-end gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={backlinkGapIncludeSubdomains} onChange={(event) => setBacklinkGapIncludeSubdomains(event.target.checked)} className="accent-emerald-500" />
              {t('backlinkUi.includeSubdomains')}
            </label>
            <button type="button" onClick={() => { setBacklinkGapCompetitors(parsedCompetitors); void analyzeBacklinkGap(inputTarget, parsedCompetitors); }} disabled={isBacklinkGapLoading || !inputTarget.trim() || parsedCompetitors.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
              {isBacklinkGapLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {t('backlinkUi.analyzeGap')}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-amber-300/80">{t('backlinkUi.gapNotice')}</p>
        {backlinkGapError && <div role="alert" className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-300">{backlinkGapError}</div>}
        {backlinkGapReport && (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <div className="flex flex-col gap-1 border-b border-slate-800 bg-slate-950/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-medium text-slate-200">{t('backlinkUi.gapSummary', { opportunities: backlinkGapReport.opportunities.length.toLocaleString(appLocale()), scanned: backlinkGapReport.rows_scanned.toLocaleString(appLocale()), total: backlinkGapReport.total_rows?.toLocaleString(appLocale()) ?? t('backlinkUi.unknownCount') })}</span>
              <div className="flex items-center justify-between gap-3"><span className="text-[11px] text-slate-500">{t('backlinkUi.excludedTarget', { target: backlinkGapReport.target })}</span><button type="button" onClick={() => downloadBacklinkGapCsv(backlinkGapReport)} className="inline-flex shrink-0 items-center gap-1.5 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-emerald-500/50 hover:text-white"><Download className="h-3 w-3" />{t('backlinkUi.exportCsv')}</button></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-slate-900 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">{t('backlinkUi.referringDomain')}</th><th className="px-4 py-3">{t('backlinkUi.competitorBacklinks')}</th><th className="px-4 py-3 text-right">{t('backlinkUi.maxSpamScore')}</th></tr></thead>
                <tbody className="divide-y divide-slate-800/70">
                  {backlinkGapReport.opportunities.map((item) => <tr key={item.referring_domain} className="align-top hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-slate-200">{item.referring_domain}</td>
                    <td className="px-4 py-3"><ul className="space-y-1">{item.competitor_backlinks.map((competitor) => <li key={competitor.domain} className="flex items-center justify-between gap-5 text-slate-400"><span className="font-mono">{competitor.domain}</span><span className="whitespace-nowrap">{competitor.backlinks.toLocaleString(appLocale())} · {t('backlinkUi.rank')} {competitor.rank ?? '—'}</span></li>)}</ul></td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{item.max_competitor_spam_score ?? '—'}</td>
                  </tr>)}
                  {backlinkGapReport.opportunities.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">{t('backlinkUi.noGaps')}</td></tr>}
                </tbody>
              </table>
            </div>
            {backlinkGapReport.total_rows !== null && backlinkGapReport.rows_scanned < backlinkGapReport.total_rows && <div className="border-t border-slate-800 p-3 text-right"><button type="button" onClick={() => void loadMoreBacklinkGap()} disabled={isBacklinkGapLoading} className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-emerald-400/50 disabled:opacity-50">{isBacklinkGapLoading ? t('backlinkUi.loading') : t('backlinkUi.loadMoreGap')}</button></div>}
          </div>
        )}
      </section>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {backlinkProfile && (
        <div className="space-y-8">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('backlinkUi.totalBacklinks')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {backlinkProfile.total_backlinks.toLocaleString(appLocale())}
              </div>
              <span className="text-[11px] text-slate-500">{t('backlinkUi.knownInbound')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('backlinkUi.referringDomains')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {backlinkProfile.referring_domains.toLocaleString(appLocale())}
              </div>
              <span className="text-[11px] text-slate-500">{t('backlinkUi.uniqueRoots')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>{t('backlinkUi.referringSubnets')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {backlinkProfile.referring_subnets?.toLocaleString(appLocale()) ?? '—'}
              </div>
              <span className="text-[11px] text-slate-500">{t('backlinkUi.classC')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('backlinkUi.domainRank')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">{backlinkProfile.domain_rank} / 100</div>
              <span className="text-[11px] text-slate-500">{t('backlinkUi.backlinkAuthority')}</span>
            </div>
          </div>

          {backlinkProfileHistory.filter((snapshot) => snapshot.domain === backlinkProfile.domain).length > 1 && (
            <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/30 p-4" aria-labelledby="backlink-profile-history-title">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <h2 id="backlink-profile-history-title" className="text-sm font-semibold text-slate-200">{t('backlinkUi.historyTitle')}</h2>
                  <p className="text-xs text-slate-500">{t('backlinkUi.historyDescription')}</p>
                </div>
                <span className="text-[11px] text-slate-500">{t('backlinkUi.historySnapshots', { count: backlinkProfileHistory.filter((snapshot) => snapshot.domain === backlinkProfile.domain).length })}</span>
              </div>
              {(() => {
                const history = backlinkProfileHistory.filter((snapshot) => snapshot.domain === backlinkProfile.domain);
                return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { key: 'totalBacklinksTrend', values: history.map((snapshot) => snapshot.total_backlinks) },
                    { key: 'referringDomainsTrend', values: history.map((snapshot) => snapshot.referring_domains) },
                    { key: 'domainRankTrend', values: history.map((snapshot) => snapshot.domain_rank) },
                    { key: 'dofollowTrend', values: history.map((snapshot) => snapshot.dofollow_ratio) },
                  ].map((metric) => <div key={metric.key} className="rounded-md border border-slate-800/80 bg-slate-900/60 p-3">
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{t(`backlinkUi.${metric.key}`)}</p>
                    <TrendChart values={metric.values} label={`${t(`backlinkUi.${metric.key}`)} — ${backlinkProfile.domain}`} />
                  </div>)}
                </div>;
              })()}
            </section>
          )}

          {/* Dofollow vs Nofollow & Anchor Text Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Link Equity Quality Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                <span>{t('backlinkUi.equityRatio')}</span>
              </h3>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-emerald-400">{t('backlinkUi.dofollow')}: {backlinkProfile.dofollow_ratio === null ? '—' : `${backlinkProfile.dofollow_ratio}%`}</span>
                  <span className="text-slate-400">{t('backlinkUi.nofollow')}: {backlinkProfile.dofollow_ratio === null ? '—' : `${(100 - backlinkProfile.dofollow_ratio).toFixed(1)}%`}</span>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${backlinkProfile.dofollow_ratio ?? 0}%` }}
                  />
                  <div
                    className="h-full bg-slate-600 transition-all"
                    style={{ width: `${100 - (backlinkProfile.dofollow_ratio ?? 0)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 leading-relaxed">
                {t('backlinkUi.equityNotice')}
              </div>
            </div>

            {/* Anchor Distribution */}
            <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{t('backlinkUi.anchorProfile')}</span>
              </h3>
              <p className="text-[11px] text-slate-500">{t('backlinkUi.anchorSummary', { count: backlinkProfile.anchors.length, total: backlinkProfile.total_anchor_rows?.toLocaleString(appLocale()) ?? t('backlinkUi.unknownCount') })}</p>
              <p className="text-[11px] text-slate-500">{t('backlinkUi.anchorNotice')}</p>

              <div className="space-y-2.5">
                {backlinkProfile.anchors.map((anc, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-200 truncate max-w-sm font-mono">{anc.anchor}</span>
                      <span className="text-slate-400 font-mono">
                        {t('backlinkUi.anchorCount', { count: anc.count, percentage: anc.percentage === null ? '—' : `${anc.percentage}%` })}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${anc.percentage ?? 0}%` }}
                      />
                    </div>
                  </div>
                ))}
                {backlinkProfile.anchors.length === 0 && <p className="text-xs text-slate-500">{t('backlinkUi.noAnchors')}</p>}
              </div>
              {backlinkProfile.total_anchor_rows !== null && backlinkProfile.anchors.length < backlinkProfile.total_anchor_rows && (
                <button type="button" onClick={() => void loadMoreBacklinkAnchors()} disabled={isLoading} className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-emerald-400/50 disabled:opacity-50">
                  {isLoading ? t('backlinkUi.loading') : t('backlinkUi.loadAnchors')}
                </button>
              )}
            </div>
          </div>

          {/* Inbound Backlinks Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">{t('backlinkUi.returnedBacklinks')}</h3>
              <span className="text-xs text-slate-400 font-mono">{backlinkProfile.backlinks.length.toLocaleString(appLocale())} / {backlinkProfile.total_backlink_rows?.toLocaleString(appLocale()) ?? t('backlinkUi.unknownCount')}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">{t('backlinkUi.sourcePage')}</th>
                    <th className="px-4 py-3">{t('backlinkUi.anchorText')}</th>
                    <th className="px-4 py-3 text-center">{t('backlinkUi.type')}</th>
                    <th className="px-4 py-3 text-center">{t('backlinkUi.dr')}</th>
                    <th className="px-4 py-3 text-right">{t('backlinkUi.firstSeen')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {backlinkProfile.backlinks.map((b, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-medium text-slate-200 truncate">{b.source_title}</div>
                        <div className="text-[11px] text-slate-500 truncate font-mono">{b.source_url}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300 max-w-[200px] truncate">
                        "{b.anchor_text}"
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            b.is_dofollow
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {b.is_dofollow ? t('backlinkUi.dofollow') : t('backlinkUi.nofollow')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-amber-400">
                        {b.domain_rank}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">{b.first_seen}</td>
                    </tr>
                  ))}
                  {backlinkProfile.backlinks.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-500">{t('backlinkUi.noBacklinks')}</td></tr>}
                </tbody>
              </table>
            </div>
            {backlinkProfile.total_backlink_rows !== null && backlinkProfile.backlinks.length < backlinkProfile.total_backlink_rows && (
              <div className="flex flex-col gap-2 border-t border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[11px] text-slate-500">{t('backlinkUi.moreBacklinkNotice')}</span>
                <button type="button" onClick={() => void loadMoreBacklinks()} disabled={isLoading} className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-emerald-400/50 disabled:opacity-50">
                  {isLoading ? t('backlinkUi.loading') : t('backlinkUi.loadBacklinks')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
