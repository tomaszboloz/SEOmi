import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildSemanticAudit, type SemanticAuditFinding } from '@/services/semanticAudit';
import type { TopicalMapDocument } from '@/services/topicalMap';
import type { CrawlRunRecord, CrawledPageSummary } from '@/types';
import { compareSemanticRuns, type SemanticRunChange } from '@/services/semanticRunComparison';
import { appLocale } from '@/services/localeFormat';
import { monitorSemanticComparison } from '@/services/monitoringAlerts';
import { useProjectStore } from '@/stores/projectStore';
import { guardCrawlComparison } from '@/services/crawlComparisonContract';

interface Props { document: TopicalMapDocument; pages: CrawledPageSummary[]; runs?: CrawlRunRecord[]; currentRunId?: string; }
type Filter = 'all' | 'risk' | 'review' | 'notice';
const completionLabel = (value: string): string => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(appLocale()) : '—';
};
const completionTime = (value: string): number => Number.isFinite(Date.parse(value)) ? Date.parse(value) : -Infinity;

const severityStyles = {
  risk: 'border-rose-500/25 bg-rose-500/5 text-rose-200',
  review: 'border-amber-500/25 bg-amber-500/5 text-amber-100',
  notice: 'border-slate-700 bg-slate-950/40 text-slate-300',
} as const;
const provenanceStyles = {
  measured: 'border-sky-500/20 bg-sky-500/5 text-sky-200',
  derived: 'border-violet-500/20 bg-violet-500/5 text-violet-200',
  asserted: 'border-amber-500/20 bg-amber-500/5 text-amber-200',
} as const;

export const SemanticAuditPanel = ({ document, pages, runs = [], currentRunId }: Props) => {
  const { t } = useTranslation();
  const projectId = useProjectStore((state) => state.activeProjectId);
  const report = useMemo(() => buildSemanticAudit(document, pages), [document, pages]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const currentRun = currentRunId ? runs.find((run) => run.id === currentRunId) ?? null : null;
  const baselineRuns = runs.filter((run) => run.id !== currentRun?.id).sort((left, right) => completionTime(right.completedAt) - completionTime(left.completedAt));
  const [selectedBaselineRunId, setSelectedBaselineRunId] = useState('');
  const baselineRun = baselineRuns.find((run) => run.id === selectedBaselineRunId) ?? baselineRuns[0] ?? null;
  const currentSnapshotRun = currentRun ? { ...currentRun, result: { ...currentRun.result, pages } } : null;
  const comparisonGuard = baselineRun && currentSnapshotRun ? guardCrawlComparison(currentSnapshotRun, baselineRun, { projectId: projectId ?? undefined }) : null;
  const rawComparison = baselineRun && currentSnapshotRun ? compareSemanticRuns(document, baselineRun, { id: currentRunId || 'current-snapshot', pages }, { guard: comparisonGuard ?? undefined }) : null;
  const comparison = rawComparison && comparisonGuard ? { ...rawComparison, guard: comparisonGuard } : rawComparison;
  const comparisonKey = comparison ? `${comparison.baselineRunId}:${comparison.currentRunId}:${comparison.truncated}:${comparison.guard?.status}:${comparison.guard?.reasons.join(',')}:${Object.values(comparison.counts).join(',')}` : '';
  useEffect(() => { if (projectId && comparison && comparisonKey) void monitorSemanticComparison(projectId, comparison); }, [projectId, comparisonKey]);
  const comparisonLabels: Record<(typeof comparisonCounts)[number]['code'], string> = {
    'url-added': t('semanticAudit.comparison.urlAdded'),
    'url-not-observed': t('semanticAudit.comparison.urlNotObserved'),
    'content-terms-changed': t('semanticAudit.comparison.contentTermsChanged'),
    'content-link-added': t('semanticAudit.comparison.contentLinkAdded'),
    'content-link-not-observed': t('semanticAudit.comparison.contentLinkNotObserved'),
    'topic-edge-added': t('semanticAudit.comparison.topicEdgeAdded'),
    'topic-edge-not-observed': t('semanticAudit.comparison.topicEdgeNotObserved'),
    'topic-url-coverage-changed': t('semanticAudit.comparison.topicUrlCoverageChanged'),
    'query-term-observation-changed': t('semanticAudit.comparison.queryTermObservationChanged'),
  };
  const counts = {
    risk: report.findings.filter((finding) => finding.severity === 'risk').length,
    review: report.findings.filter((finding) => finding.severity === 'review').length,
    notice: report.findings.filter((finding) => finding.severity === 'notice').length,
  };
  const visible = report.findings.filter((finding) => (filter === 'all' || finding.severity === filter)
    && (!search || `${finding.title} ${finding.detail} ${finding.urls.join(' ')} ${finding.evidence.join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));

  return (
    <div className="space-y-4">
      <header className="overflow-hidden rounded-xl border border-sky-500/20 bg-[linear-gradient(112deg,rgba(14,165,233,.09),rgba(15,23,42,.2)_46%,rgba(139,92,246,.055))] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-sky-300">{t('semanticAudit.eyebrow')}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div><h3 className="text-lg font-semibold tracking-tight text-slate-100">{t('semanticAudit.title')}</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{t('semanticAudit.description')}</p></div>
          <div className="rounded-lg border border-slate-700/80 bg-slate-950/45 px-3 py-2 text-right"><span className="block text-[9px] uppercase tracking-wide text-slate-500">{t('semanticAudit.score')}</span><span className="text-xs font-medium text-slate-300">{t('semanticAudit.scoreNotCalculated')}</span></div>
        </div>
      </header>

      <section aria-label={t('semanticAudit.scopeAria')} className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        <Summary label={t('semanticAudit.mappedTopics')} value={`${report.mappedTopics}/${report.totalTopics}`} detail={t('semanticAudit.mappedTopicsDetail')} />
        <Summary label={t('semanticAudit.mappedPages')} value={`${report.mappedPages}/${report.totalPages}`} detail={t('semanticAudit.mappedPagesDetail')} />
        <Summary label={t('semanticAudit.entityDeclarations')} value={String(report.entityObservability.length)} detail={t('semanticAudit.entityDeclarationsDetail')} />
        <Summary label={t('semanticAudit.contentOrphans')} value={report.contentOrphanPages === null ? '—' : String(report.contentOrphanPages)} detail={report.contentOrphanPages === null ? t('semanticAudit.contentOrphansUnavailable') : t('semanticAudit.contentOrphansDetail')} />
        <Summary label={t('semanticAudit.reviewSignals')} value={String(counts.risk + counts.review)} detail={t('semanticAudit.reviewSignalsDetail', { risk: counts.risk, review: counts.review })} />
      </section>

      <section aria-label={t('semanticAudit.comparisonAria')} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h4 className="text-xs font-semibold text-slate-200">{t('semanticAudit.comparisonTitle')}</h4><p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-500">{t('semanticAudit.comparisonDescription')}</p></div>
          {baselineRuns.length > 0 && <label className="text-[10px] text-slate-500">{t('semanticAudit.baselineRun')}<select aria-label={t('semanticAudit.baselineRunAria')} value={baselineRun?.id ?? ''} onChange={(event) => setSelectedBaselineRunId(event.target.value)} className="mt-1 block h-9 min-w-56 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-sky-400">{baselineRuns.map((run) => <option key={run.id} value={run.id}>{completionLabel(run.completedAt)} · {t('crawl.ui.urlsCount', { count: run.result.pages_crawled })}</option>)}</select></label>}
        </div>
        {!baselineRun && <p className="mt-3 rounded-md border border-dashed border-slate-800 px-3 py-5 text-center text-[10px] text-slate-500">{t('semanticAudit.noBaseline')}</p>}
        {comparison && <>
          {comparison.guard && <p role="status" data-testid="semantic-comparison-guard" className="mt-3 rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-[10px] leading-4 text-slate-300">{t('siteAudit.comparisonGuard', { status: comparison.guard.status, reasons: `${comparison.guard.reasons.map((reason) => t(`siteAudit.comparisonReasons.${reason}`)).join(', ') || 'none'} [${comparison.guard.reasons.join(', ')}]` })}</p>}
          {comparison.guard?.status === 'comparable' && <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{comparisonCounts.map((item) => <div key={item.code} className="rounded-md border border-slate-800 bg-slate-950/45 px-2 py-2"><span className="block font-mono text-lg tabular-nums text-slate-100">{comparison.counts[item.code]}</span><span className="block text-[9px] leading-3 text-slate-500">{comparisonLabels[item.code]}</span></div>)}</div>
          {comparison.changes.length > 0 ? <ul className="mt-3 max-h-[min(55vh,560px)] divide-y divide-slate-800 overflow-y-auto rounded-lg border border-slate-800 px-3">{comparison.changes.map((change) => <SemanticChange key={change.id} change={change} t={t} />)}</ul> : <p className="mt-3 rounded-md border border-dashed border-slate-800 px-3 py-5 text-center text-[10px] text-slate-500">{t('semanticAudit.noChanges')}</p>}
          {comparison.truncated && <p role="status" className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-100">{t('semanticAudit.comparisonTruncated')}</p>}
          </>}
        </>}
      </section>

      {report.entityObservability.length > 0 && <section className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><div><h4 className="text-xs font-semibold text-slate-200">{t('semanticAudit.entityTitle')}</h4><p className="mt-1 text-[10px] text-slate-500">{t('semanticAudit.entityDescription')}</p></div><span className="font-mono text-[9px] text-slate-600">{t('semanticAudit.provenanceFlow')}</span></div><div className="space-y-2">{report.entityObservability.map((item) => { const percent = item.comparablePages ? Math.round(item.observedPages / item.comparablePages * 100) : null; return <div key={item.label} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/35 p-2.5 sm:grid-cols-[minmax(140px,.7fr)_minmax(120px,1.5fr)_auto] sm:items-center"><span className="truncate text-[11px] text-slate-300" title={item.label}>{item.label}</span><span className="relative h-1.5 overflow-hidden rounded-full bg-slate-800" aria-label={percent === null ? t('semanticAudit.noComparablePages') : t('semanticAudit.percentPages', { percent })}><span className="absolute inset-y-0 left-0 rounded-full bg-sky-400" style={{ width: `${percent ?? 0}%` }} /></span><span className="whitespace-nowrap font-mono text-[10px] text-slate-500">{item.observedPages}/{item.comparablePages}{percent === null ? ` · ${t('semanticAudit.noSample')}` : ''}</span></div>; })}</div></section>}

      <section className="rounded-xl border border-slate-800 bg-slate-900/45 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h4 className="text-xs font-semibold text-slate-200">{t('semanticAudit.findingsTitle')}</h4><p className="mt-1 text-[10px] text-slate-500">{t('semanticAudit.findingsCount', { count: report.findings.length })}</p></div><label className="text-[10px] text-slate-500">{t('semanticAudit.searchLabel')}<input aria-label={t('semanticAudit.searchAria')} value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 block h-8 w-full min-w-56 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-sky-400" placeholder={t('semanticAudit.searchPlaceholder')} /></label></div>
        <div role="group" aria-label={t('semanticAudit.filterAria')} className="mt-3 flex flex-wrap gap-1.5">{([['all', t('semanticAudit.filterAll', { count: report.findings.length })], ['risk', t('semanticAudit.filterRisk', { count: counts.risk })], ['review', t('semanticAudit.filterReview', { count: counts.review })], ['notice', t('semanticAudit.filterNotice', { count: counts.notice })]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-md border px-2 py-1.5 text-[10px] ${filter === value ? 'border-sky-500/30 bg-sky-500/10 text-sky-100' : 'border-slate-800 text-slate-500 hover:text-slate-200'}`}>{label}</button>)}</div>

        {visible.length ? <ul className="mt-3 divide-y divide-slate-800">{visible.map((finding) => <Finding key={finding.id} finding={finding} t={t} />)}</ul> : <div className="mt-3 rounded-lg border border-dashed border-slate-800 px-4 py-10 text-center"><p className="text-xs font-medium text-slate-300">{report.findings.length ? t('semanticAudit.noFilterMatches') : t('semanticAudit.noFindings')}</p><p className="mt-1 text-[10px] text-slate-600">{report.findings.length ? t('semanticAudit.changeFilter') : t('semanticAudit.noAuthorityProof')}</p></div>}
        {report.truncated && <p role="status" className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-100">{t('semanticAudit.analysisTruncated')}</p>}
      </section>

      <p className="text-[9px] leading-4 text-slate-600">{t('semanticAudit.scopeNote')}</p>
    </div>
  );
};

const Finding = ({ finding, t }: { finding: SemanticAuditFinding; t: (key: string, options?: Record<string, unknown>) => string }) => <li className="py-3 first:pt-1 last:pb-1"><div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className={`rounded border px-1.5 py-1 text-[9px] font-medium ${severityStyles[finding.severity]}`}>{t(`semanticAudit.severity.${finding.severity}`)}</span><h5 className="text-[11px] font-semibold text-slate-200">{finding.title}</h5></div><p className="mt-1.5 max-w-4xl text-[10px] leading-4 text-slate-400">{finding.detail}</p><p className="mt-2 rounded-md border border-sky-500/10 bg-sky-500/[.035] px-2.5 py-2 text-[10px] leading-4 text-sky-100"><span className="mr-1.5 font-semibold text-sky-300">{t('semanticAudit.actionLabel')}</span>{finding.action}</p>{finding.urls.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{finding.urls.slice(0, 8).map((url) => <code key={url} title={url} className="max-w-full truncate rounded border border-slate-800 bg-slate-950/70 px-1.5 py-1 font-mono text-[9px] text-slate-400">{url}</code>)}{finding.urls.length > 8 && <span className="self-center text-[9px] text-slate-600">{t('semanticAudit.moreUrls', { count: finding.urls.length - 8 })}</span>}</div>}<div className="mt-2 flex flex-wrap gap-1">{finding.evidence.map((item) => <span key={item} className="rounded bg-slate-950/60 px-1.5 py-1 text-[9px] text-slate-500">{item}</span>)}</div></div><div className="flex shrink-0 flex-wrap items-center gap-1">{finding.provenance.map((source) => <span key={source} className={`rounded border px-1.5 py-1 font-mono text-[9px] ${provenanceStyles[source]}`}>{t(`semanticAudit.provenance.${source}`)}</span>)}<span className="rounded border border-slate-800 px-1.5 py-1 text-[9px] text-slate-600">{t('semanticAudit.confidence', { value: finding.confidence === 'moderate' ? t('semanticAudit.confidenceModerate') : t('semanticAudit.confidenceLimited') })}</span></div></div></li>;

const Summary = ({ label, value, detail }: { label: string; value: string; detail: string }) => <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-3"><p className="text-[9px] font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1.5 font-mono text-lg font-medium tabular-nums text-slate-100">{value}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{detail}</p></div>;

const comparisonCounts: Array<{ code: keyof import('@/services/semanticRunComparison').SemanticRunComparisonReport['counts'] }> = [
  { code: 'url-added' },
  { code: 'url-not-observed' },
  { code: 'content-terms-changed' },
  { code: 'content-link-added' },
  { code: 'content-link-not-observed' },
  { code: 'topic-edge-added' },
  { code: 'topic-edge-not-observed' },
  { code: 'topic-url-coverage-changed' },
  { code: 'query-term-observation-changed' },
];

const SemanticChange = ({ change, t }: { change: SemanticRunChange; t: (key: string, options?: Record<string, unknown>) => string }) => <li className="py-3 first:pt-3 last:pb-3"><div className="flex flex-wrap items-baseline gap-2"><h5 className="text-[10px] font-semibold text-slate-200">{change.title}</h5>{change.topicId && <span className="rounded border border-violet-500/20 px-1.5 py-0.5 font-mono text-[8px] text-violet-300">{t('semanticAudit.topicalTag')}</span>}</div><p className="mt-1 text-[9px] leading-4 text-slate-500">{change.detail}</p>{change.urls.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{change.urls.map((url) => <code key={url} className="max-w-full truncate rounded bg-slate-950 px-1.5 py-1 font-mono text-[8px] text-slate-400">{url}</code>)}</div>}<div className="mt-1 flex flex-wrap gap-1">{change.evidence.map((item) => <span key={item} className="rounded bg-slate-950/65 px-1.5 py-1 text-[8px] text-slate-500">{item}</span>)}</div></li>;
