import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe2,
  TrendingUp,
  Search,
  Link2,
  Users,
  FileText,
  Shield,
  Loader2,
  Layers,
  BarChart3,
} from 'lucide-react';
import { useToolsStore } from '@/stores/toolsStore';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { TrendChart } from '@/components/Charts/TrendChart';
import { DataForSeoLanguagePicker, DataForSeoLocationPicker } from '@/components/DataForSEO/DataForSeoPickers';
import { dataForSeoLanguage, dataForSeoMarket } from '@/services/dataforseo';
import { appLocale } from '@/services/localeFormat';

export const DomainOverview: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useProjectStore((s) => s.projects.find((project) => project.id === s.activeProjectId));
  const domainQuery = useToolsStore((s) => s.domainQuery);
  const domainCountry = useToolsStore((s) => s.domainCountry);
  const domainLanguage = useToolsStore((s) => s.domainLanguage);
  const domainOverview = useToolsStore((s) => s.domainOverview);
  const isLoading = useToolsStore((s) => s.isDomainLoading);
  const error = useToolsStore((s) => s.domainError);
  const setDomainQuery = useToolsStore((s) => s.setDomainQuery);
  const setDomainCountry = useToolsStore((s) => s.setDomainCountry);
  const setDomainLanguage = useToolsStore((s) => s.setDomainLanguage);
  const analyzeDomain = useToolsStore((s) => s.analyzeDomain);
  const domainComparison = useToolsStore((s) => s.domainComparison);
  const domainComparisonHistory = useToolsStore((s) => s.domainComparisonHistory || []);
  const domainComparisonTargets = useToolsStore((s) => s.domainComparisonTargets);
  const isDomainComparisonLoading = useToolsStore((s) => s.isDomainComparisonLoading);
  const domainComparisonError = useToolsStore((s) => s.domainComparisonError);
  const compareDomains = useToolsStore((s) => s.compareDomains);
  const setDomainComparisonTargets = useToolsStore((s) => s.setDomainComparisonTargets);
  const setBacklinkQuery = useToolsStore((s) => s.setBacklinkQuery);
  const setCrawlUrl = useToolsStore((s) => s.setCrawlUrl);
  const setActiveTab = useAuditStore((s) => s.setActiveTab);

  const [inputDomain, setInputDomain] = useState(domainQuery);
  const [comparisonInput, setComparisonInput] = useState('');
  const initializedProjectRef = useRef<string | null>(null);

  useEffect(() => {
    const comparisonTarget = domainOverview?.domain || inputDomain;
    setComparisonInput(domainComparisonTargets.filter((domain) => domain !== comparisonTarget).join('\n'));
  }, [domainComparisonTargets, domainOverview?.domain, inputDomain]);

  // Keep the editable field aligned with the hydrated project snapshot while
  // preserving free typing until the user submits it.
  useEffect(() => {
    setInputDomain(domainQuery);
  }, [activeProjectId, domainQuery]);

  // A new project should be immediately usable in every domain workflow.
  // Only fill an empty field; an explicitly entered/saved target always wins.
  useEffect(() => {
    const projectRoot = activeProject?.rootUrl?.trim();
    if (!activeProjectId || initializedProjectRef.current === activeProjectId) return;
    initializedProjectRef.current = activeProjectId;
    if (!projectRoot || domainQuery.trim()) return;
    setDomainQuery(projectRoot);
    setInputDomain(projectRoot);
  }, [activeProject?.rootUrl, activeProjectId, domainQuery, setDomainQuery]);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputDomain.trim()) return;
    setDomainQuery(inputDomain.trim());
    analyzeDomain(inputDomain.trim(), domainCountry, domainLanguage);
  };

  const handleNavigateBacklinks = () => {
    const target = domainOverview?.domain || inputDomain;
    setBacklinkQuery(target);
    setActiveTab('backlink-checker');
  };

  const handleNavigateSiteAudit = () => {
    const target = domainOverview?.domain || inputDomain;
    setCrawlUrl(`https://${target}`);
    setActiveTab('site-audit');
  };

  const handleCompareDomains = (event: React.FormEvent) => {
    event.preventDefault();
    const competitors = comparisonInput.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
    setDomainComparisonTargets([domainOverview?.domain || inputDomain, ...competitors]);
    void compareDomains([domainOverview?.domain || inputDomain, ...competitors]);
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
            <span className="text-xs text-slate-400 font-mono">{t('domainResearchUi.eyebrow')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">{t('domainResearchUi.title')}</h1>
          <p className="text-sm text-slate-400">
            {t('domainResearchUi.description')}
          </p>
        </div>

        {domainOverview && (
          <div className="flex items-center space-x-3">
            <button
              onClick={handleNavigateBacklinks}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition"
            >
              <Link2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('domainResearchUi.backlinkProfile')}</span>
            </button>
            <button
              onClick={handleNavigateSiteAudit}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 transition shadow-md shadow-emerald-950"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('domainResearchUi.runCrawler')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Domain Input Bar */}
      <p className="text-xs text-amber-200">{t('dataforseo.paidRequests', { count: 5 })}</p>
      <form
        onSubmit={handleAnalyze}
        className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row gap-3 shadow-lg"
      >
        <div className="flex-1 relative">
          <Globe2 className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={inputDomain}
            onChange={(e) => setInputDomain(e.target.value)}
            placeholder={t('domainResearchUi.domainPlaceholder')}
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
          />
        </div>

        <DataForSeoLocationPicker
          value={domainCountry}
          onChange={(country) => {
            setDomainCountry(country);
            setDomainLanguage(dataForSeoLanguage(country, domainLanguage));
          }}
          ariaLabel={t('dataforseo.locationLabel')}
          placeholder={t('dataforseo.locationLabel')}
          className="w-full md:w-56"
        />
        <DataForSeoLanguagePicker
          value={domainLanguage}
          market={dataForSeoMarket(domainCountry)}
          onChange={setDomainLanguage}
          ariaLabel={t('dataforseo.languageLabel')}
          placeholder={t('dataforseo.languageLabel')}
          className="w-full md:w-48"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-950"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('domainResearchUi.scanning')}</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span>{t('domainResearchUi.analyze')}</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Domain Metrics Grid */}
      {domainOverview && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('domainResearchUi.monthlyTraffic')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {domainOverview.organic_traffic?.toLocaleString(appLocale()) ?? '—'}
              </div>
              <span className="text-[11px] text-slate-500">{t('domainResearchUi.estimatedVisitors')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <Search className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('domainResearchUi.organicKeywords')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {domainOverview.organic_keywords?.toLocaleString(appLocale()) ?? '—'}
              </div>
              <span className="text-[11px] text-slate-500">{t('domainResearchUi.rankedTop100')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('domainResearchUi.domainRank')}</span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-white font-mono">{domainOverview.domain_rank ?? '—'}</span>
                {domainOverview.domain_rank !== null && <span className="text-xs text-slate-400 font-mono">/ 100</span>}
              </div>
              <span className="text-[11px] text-slate-500">{t('domainResearchUi.authorityStrength')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
                <Link2 className="w-3.5 h-3.5 text-purple-400" />
                <span>{t('domainResearchUi.referringDomains')}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {domainOverview.referring_domains?.toLocaleString(appLocale()) ?? '—'}
              </div>
              <span className="text-[11px] text-slate-500">{t('domainResearchUi.uniqueRootDomains')}</span>
            </div>
          </div>

          {/* Top Organic Keywords & Top Pages Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Keywords */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-400" />
                  <span>{t('domainResearchUi.topKeywords')}</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">{t('domainResearchUi.topTrafficContributors')}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500 uppercase border-b border-slate-800">
                    <tr>
                      <th className="pb-2">{t('domainResearchUi.keyword')}</th>
                      <th className="pb-2 text-center">{t('domainResearchUi.position')}</th>
                      <th className="pb-2 text-right">{t('domainResearchUi.volume')}</th>
                      <th className="pb-2 text-right">{t('domainResearchUi.trafficPercent')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {domainOverview.top_keywords.map((k, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 font-sans font-medium text-slate-200">{k.keyword}</td>
                        <td className="py-2.5 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                            {k.position === null ? '—' : `#${k.position}`}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-slate-300">{k.search_volume?.toLocaleString(appLocale()) ?? '—'}</td>
                        <td className="py-2.5 text-right text-slate-400">{k.traffic_share === null ? '—' : `${k.traffic_share}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Organic Pages */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>{t('domainResearchUi.topPages')}</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">{t('domainResearchUi.organicVisibility')}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500 uppercase border-b border-slate-800">
                    <tr>
                      <th className="pb-2">{t('domainResearchUi.landingUrl')}</th>
                      <th className="pb-2 text-right">{t('domainResearchUi.trafficShare')}</th>
                      <th className="pb-2 text-right">{t('domainResearchUi.keywords')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {domainOverview.top_pages.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 text-slate-300 truncate max-w-[200px]">{p.url}</td>
                        <td className="py-2.5 text-right text-emerald-400 font-bold">{p.traffic_percentage === null ? '—' : `${p.traffic_percentage}%`}</td>
                        <td className="py-2.5 text-right text-slate-400">{p.keywords_count?.toLocaleString(appLocale()) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Organic Competitors */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span>{t('domainResearchUi.competitors')}</span>
              </h3>
              <span className="text-xs text-slate-400">{t('domainResearchUi.landscapeOverlap')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {domainOverview.competitors.map((c, i) => (
                <div key={i} className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-white font-mono text-sm">{c.domain}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {c.common_keywords?.toLocaleString(appLocale()) ?? '—'} {t('domainResearchUi.overlappingKeywords')}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                    <span className="text-slate-500">{t('domainResearchUi.averagePosition')}</span>
                    <span className="font-mono font-bold text-amber-400">{c.average_position ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-xl border border-violet-500/20 bg-slate-900/60 p-5 space-y-4" aria-label={t('domainResearchUi.compareDomains')}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-violet-300" />{t('domainResearchUi.compareDomains')}</h3>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{t('domainResearchUi.compareDescription')}</p>
              </div>
              {domainComparison && <span className="shrink-0 text-[11px] text-slate-500">{t('domainResearchUi.domainCount', { count: domainComparison.rows.length, date: new Date(domainComparison.retrieved_at).toLocaleString(appLocale()) })}</span>}
            </div>
            <p className="text-xs text-amber-200">{t('dataforseo.paidRequests', { count: 5 * Math.min(5, 1 + comparisonInput.split(/[\n,;]+/).filter((value) => value.trim()).length) })}</p>
            <form onSubmit={handleCompareDomains} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="text-xs text-slate-400">{t('domainResearchUi.competitorInputLabel')}<textarea aria-label={t('domainResearchUi.competitorInputAria')} value={comparisonInput} onChange={(event) => { const next = event.target.value; setComparisonInput(next); const competitors = next.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean); setDomainComparisonTargets([domainOverview?.domain || inputDomain, ...competitors]); }} rows={2} placeholder={t('domainResearchUi.competitorPlaceholder')} className="mt-1.5 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-violet-400" /></label>
              <button type="submit" disabled={isDomainComparisonLoading || !inputDomain.trim()} className="inline-flex h-9 items-center justify-center gap-1.5 self-end rounded-md bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-wait disabled:opacity-50">{isDomainComparisonLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}{t('domainResearchUi.compareLive')}</button>
            </form>
            {domainComparisonError && <p role="alert" className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">{domainComparisonError}</p>}
            {domainComparison && <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">{t('domainResearchUi.domain')}</th><th className="px-3 py-2 text-right">{t('domainResearchUi.organicEtv')}</th><th className="px-3 py-2 text-right">{t('domainResearchUi.keywords')}</th><th className="px-3 py-2 text-right">{t('domainResearchUi.domainRankHeader')}</th><th className="px-3 py-2 text-right">{t('domainResearchUi.referringHeader')}</th><th className="px-3 py-2 text-right">{t('backlinkUi.totalBacklinks')}</th><th className="px-3 py-2 text-right">{t('backlinkUi.dofollow')}</th></tr></thead>
                <tbody className="divide-y divide-slate-800/70">
                  {domainComparison.rows.map((row) => {
                    const maxTraffic = Math.max(...domainComparison.rows.map((item) => item.organic_traffic ?? 0), 1);
                    const trafficWidth = row.organic_traffic === null ? 0 : Math.round((row.organic_traffic / maxTraffic) * 100);
                    return <tr key={row.domain} className="text-slate-300 hover:bg-slate-800/30"><td className="px-3 py-2.5 font-mono font-medium text-white"><div>{row.domain}{row.domain === domainComparison.target && <span className="ml-2 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200">{t('domainResearchUi.project')}</span>}</div><span className="mt-1 block h-1 max-w-40 rounded-full bg-slate-800"><span className="block h-1 rounded-full bg-violet-400" style={{ width: `${trafficWidth}%` }} /></span>{(row.top_keywords?.length || row.top_pages?.length || row.competitors?.length) ? <details className="mt-2 max-w-80 font-sans text-[10px] font-normal text-slate-400"><summary className="cursor-pointer select-none text-violet-300">{t('domainResearchUi.topKeywords')} · {t('domainResearchUi.topPages')}</summary><div className="mt-2 space-y-2 rounded border border-slate-800 bg-slate-950/60 p-2"><div><p className="mb-1 text-slate-500">{t('domainResearchUi.topKeywords')}</p>{(row.top_keywords || []).slice(0, 5).map((item) => <div key={`${row.domain}-kw-${item.keyword}`} className="flex justify-between gap-2"><span className="truncate" title={item.keyword}>{item.keyword}</span><span className="shrink-0 font-mono">{item.position === null ? '—' : `#${item.position}`}</span></div>)}</div><div><p className="mb-1 text-slate-500">{t('domainResearchUi.topPages')}</p>{(row.top_pages || []).slice(0, 5).map((item) => <div key={`${row.domain}-page-${item.url}`} className="truncate" title={item.url}>{item.url}</div>)}</div>{(row.competitors || []).length > 0 && <div><p className="mb-1 text-slate-500">{t('domainResearchUi.competitors')}</p>{(row.competitors || []).slice(0, 5).map((item) => <div key={`${row.domain}-comp-${item.domain}`} className="flex justify-between gap-2"><span className="truncate">{item.domain}</span><span className="shrink-0 font-mono">{item.common_keywords ?? '—'}</span></div>)}</div>}</div></details> : null}</td><td className="px-3 py-2.5 text-right font-mono">{row.organic_traffic?.toLocaleString(appLocale()) ?? '—'}</td><td className="px-3 py-2.5 text-right font-mono">{row.organic_keywords?.toLocaleString(appLocale()) ?? '—'}</td><td className="px-3 py-2.5 text-right font-mono">{row.domain_rank ?? '—'}</td><td className="px-3 py-2.5 text-right font-mono">{row.referring_domains?.toLocaleString(appLocale()) ?? '—'}</td><td className="px-3 py-2.5 text-right font-mono">{row.total_backlinks?.toLocaleString(appLocale()) ?? '—'}</td><td className="px-3 py-2.5 text-right font-mono">{row.dofollow_ratio === null || row.dofollow_ratio === undefined ? '—' : `${row.dofollow_ratio}%`}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>}
            {domainComparison && domainComparisonHistory.length > 0 && <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/30 p-4" aria-labelledby="domain-comparison-history-title">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <h4 id="domain-comparison-history-title" className="text-sm font-semibold text-slate-200">{t('domainResearchUi.historyTitle')}</h4>
                  <p className="text-xs text-slate-500">{t('domainResearchUi.historyDescription')}</p>
                </div>
                <span className="text-[11px] text-slate-500">{t('domainResearchUi.historySnapshots', { count: domainComparisonHistory.length })}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {domainComparison.rows.map((row) => {
                  const trafficValues = domainComparisonHistory.map((snapshot) => snapshot.rows.find((item) => item.domain === row.domain)?.organic_traffic ?? null);
                  const keywordValues = domainComparisonHistory.map((snapshot) => snapshot.rows.find((item) => item.domain === row.domain)?.organic_keywords ?? null);
                  return <article key={`history-${row.domain}`} className="rounded-md border border-slate-800/80 bg-slate-900/60 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h5 className="truncate font-mono text-xs font-semibold text-slate-200" title={row.domain}>{row.domain}</h5>
                      <span className="text-[10px] text-slate-500">{new Date(domainComparisonHistory[domainComparisonHistory.length - 1].retrieved_at).toLocaleDateString(appLocale())}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{t('domainResearchUi.organicTrafficTrend')}</p>
                        <TrendChart values={trafficValues} label={`${t('domainResearchUi.organicTrafficTrend')} — ${row.domain}`} />
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{t('domainResearchUi.organicKeywordsTrend')}</p>
                        <TrendChart values={keywordValues} label={`${t('domainResearchUi.organicKeywordsTrend')} — ${row.domain}`} />
                      </div>
                    </div>
                  </article>;
                })}
              </div>
            </section>}
          </section>
        </div>
      )}
    </div>
  );
};
