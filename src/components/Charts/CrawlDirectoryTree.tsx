import { z } from 'zod';
import { readJsonRecord, parseRecordEntries } from '@/services/storageContracts';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, FileText, Search, TriangleAlert } from 'lucide-react';
import type { CrawledPageSummary } from '@/types';
import { buildCrawlDirectoryTree, filterCrawlPagesForDirectoryTree, type CrawlDirectoryNode } from '@/services/crawlDirectoryTree';
import { writeJsonStorage } from '@/services/storage';

interface CrawlDirectoryTreeProps {
  pages: CrawledPageSummary[];
  projectId: string | null;
  runId: string;
  onSelectPage?: (url: string) => void;
}

interface DirectoryPreferences {
  query: string;
  expanded: Record<string, boolean>;
  visibleCounts: Record<string, number>;
  selectedUrl: string | null;
}

const PAGE_SIZE = 100;
const emptyPreferences = (): DirectoryPreferences => ({ query: '', expanded: {}, visibleCounts: {}, selectedUrl: null });
const preferenceKey = (projectId: string | null, runId: string) => projectId
  ? `seomi_project_${projectId}_crawl_directory_${runId}_v1`
  : null;

const readPreferences = (key: string | null): DirectoryPreferences => {
  if (!key) return emptyPreferences();
  try {
    const parsed = readJsonRecord(key);
    const expanded = Object.fromEntries(Object.entries(parseRecordEntries(parsed.expanded, z.boolean()))
      .filter(([id, value]) => id.length <= 2048 && typeof value === 'boolean')
      .slice(-500));
    const visibleCounts = Object.fromEntries(Object.entries(parseRecordEntries(parsed.visibleCounts, z.number().int().min(PAGE_SIZE)))
      .filter(([id, value]) => id.length <= 2060 && Number.isSafeInteger(value) && Number(value) >= PAGE_SIZE)
      .map(([id, value]) => [id, Math.min(Number(value), 1_000_000)])
      .slice(-500));
    return {
      query: typeof parsed.query === 'string' ? parsed.query.slice(0, 200) : '',
      expanded,
      visibleCounts,
      selectedUrl: typeof parsed.selectedUrl === 'string' ? parsed.selectedUrl.slice(0, 2048) : null,
    };
  } catch {
    return emptyPreferences();
  }
};

const metricSummary = (node: CrawlDirectoryNode, translate: (key: string, options?: Record<string, unknown>) => string): string => {
  const { metrics } = node;
  const problems = metrics.criticalIssues + metrics.warningIssues;
  return `${metrics.pageCount} ${translate('crawlDirectoryUi.url')} · ${metrics.indexable} ${translate('crawlDirectoryUi.eligible')}${problems ? ` · ${problems} ${translate('crawlDirectoryUi.problems')}` : ''}`;
};

const statusLabel = (page: CrawledPageSummary, translate: (key: string, options?: Record<string, unknown>) => string): string => page.request_error_kind || (page.http_status > 0 ? translate('crawl.ui.httpStatus', { status: page.http_status }) : translate('crawlDirectoryUi.noResponse'));

export const CrawlDirectoryTree = ({ pages, projectId, runId, onSelectPage }: CrawlDirectoryTreeProps) => {
  const { t } = useTranslation();
  const key = preferenceKey(projectId, runId);
  const [preferences, setPreferences] = useState<DirectoryPreferences>(() => readPreferences(key));
  const [loadedKey, setLoadedKey] = useState(key);
  const { query, expanded, visibleCounts, selectedUrl } = preferences;

  useEffect(() => {
    setPreferences(readPreferences(key));
    setLoadedKey(key);
  }, [key]);

  useEffect(() => {
    if (!key || loadedKey !== key) return;
    writeJsonStorage(key, preferences);
  }, [key, loadedKey, preferences]);

  const filteredPages = useMemo(() => filterCrawlPagesForDirectoryTree(pages, query), [pages, query]);
  const tree = useMemo(() => buildCrawlDirectoryTree(filteredPages), [filteredPages]);
  const selectedPage = pages.find((page) => page.url === selectedUrl);

  const setQuery = (value: string) => setPreferences((previous) => ({ ...previous, query: value }));
  const setSelectedUrl = (url: string) => {
    setPreferences((previous) => ({ ...previous, selectedUrl: url }));
    onSelectPage?.(url);
  };
  const setExpanded = (id: string, open: boolean) => setPreferences((previous) => ({
    ...previous,
    expanded: Object.entries({ ...previous.expanded, [id]: open }).slice(-500).reduce<Record<string, boolean>>((result, [folder, value]) => {
      result[folder] = value;
      return result;
    }, {}),
  }));
  const visibleCount = (id: string, kind: 'pages' | 'directories') => visibleCounts[`${id}:${kind}`] ?? PAGE_SIZE;
  const showMore = (id: string, kind: 'pages' | 'directories') => setPreferences((previous) => {
    const countKey = `${id}:${kind}`;
    return {
      ...previous,
      visibleCounts: Object.entries({ ...previous.visibleCounts, [countKey]: (previous.visibleCounts[countKey] ?? PAGE_SIZE) + PAGE_SIZE })
        .slice(-500)
        .reduce<Record<string, number>>((result, [keyName, value]) => { result[keyName] = value; return result; }, {}),
    };
  });

  const renderDirectory = (node: CrawlDirectoryNode) => {
    const open = expanded[node.id] ?? node.depth === 0;
    const hasContents = node.ownPages.length > 0 || node.childDirectories.length > 0;
    const pageCount = visibleCount(node.id, 'pages');
    const directoryCount = visibleCount(node.id, 'directories');
    return <li key={node.id} className="min-w-0">
      <details open={open} className="group min-w-0">
        <summary onClick={(event) => { event.preventDefault(); setExpanded(node.id, !open); }} className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden">
          <Folder className={`h-3.5 w-3.5 shrink-0 ${node.metrics.criticalIssues ? 'text-amber-300' : 'text-emerald-300'}`} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-mono text-slate-200" title={node.name}>{node.name}</span>
          <span className="shrink-0 text-[10px] text-slate-500">{metricSummary(node, t)}</span>
          {(node.metrics.criticalIssues + node.metrics.warningIssues) > 0 && <span className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-500/20 bg-amber-500/5 px-1.5 py-0.5 font-mono text-[10px] text-amber-200"><TriangleAlert className="h-3 w-3" aria-hidden="true" />{node.metrics.criticalIssues + node.metrics.warningIssues}</span>}
        </summary>
        {open && hasContents && <ul className="ml-3 border-l border-slate-800 pl-2">
          {node.ownPages.slice(0, pageCount).map((page) => <li key={page.url}>
            <button type="button" onClick={() => setSelectedUrl(page.url)} aria-pressed={selectedUrl === page.url} title={page.url} className={`flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-400 ${selectedUrl === page.url ? 'bg-emerald-400/10' : 'hover:bg-slate-900/80'}`}>
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium text-slate-200">{page.title || node.name || '/'}</span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">{page.url}</span>
              </span>
              <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${page.request_error_kind || page.http_status >= 400 ? 'border-rose-500/25 bg-rose-500/5 text-rose-200' : (page.issues ?? []).some((issue) => issue.severity === 'Critical' || issue.severity === 'Warning') ? 'border-amber-500/25 bg-amber-500/5 text-amber-200' : 'border-slate-800 text-slate-400'}`}>{statusLabel(page, t)}</span>
            </button>
          </li>)}
          {node.ownPages.length > pageCount && <li><button type="button" onClick={() => showMore(node.id, 'pages')} className="w-full rounded-md px-2 py-2 text-left text-[10px] font-medium text-sky-300 outline-none hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-400">{t('crawlDirectoryUi.showMoreUrls', { count: Math.min(PAGE_SIZE, node.ownPages.length - pageCount), remaining: node.ownPages.length - pageCount })}</button></li>}
          {node.childDirectories.slice(0, directoryCount).map(renderDirectory)}
          {node.childDirectories.length > directoryCount && <li><button type="button" onClick={() => showMore(node.id, 'directories')} className="w-full rounded-md px-2 py-2 text-left text-[10px] font-medium text-sky-300 outline-none hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-400">{t('crawlDirectoryUi.showMoreFolders', { count: Math.min(PAGE_SIZE, node.childDirectories.length - directoryCount), remaining: node.childDirectories.length - directoryCount })}</button></li>}
        </ul>}
      </details>
    </li>;
  };

  const metrics = tree.metrics;
  return <div className="space-y-3" aria-label={t('crawlDirectoryUi.sectionAria')}>
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{t('crawlDirectoryUi.title')}</h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{t('crawlDirectoryUi.description')}</p>
      </div>
      <label className="relative w-full xl:max-w-sm">
        <span className="sr-only">{t('crawlDirectoryUi.filterSr')}</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input aria-label={t('crawlDirectoryUi.filterAria')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('crawlDirectoryUi.filterPlaceholder')} className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 pl-8 pr-3 text-xs text-slate-100 outline-none focus:border-emerald-400" />
      </label>
    </div>

    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label={t('crawlDirectoryUi.metricsAria')}>
      {[
        { label: t('crawlDirectoryUi.url'), value: metrics.pageCount, tone: 'text-slate-100' },
        { label: t('crawl.ui.successStatuses'), value: metrics.status2xx, tone: 'text-emerald-300' },
        { label: t('crawlDirectoryUi.statusErrors'), value: metrics.status4xx + metrics.status5xx + metrics.requestErrors, tone: 'text-rose-300' },
        { label: t('crawlDirectoryUi.criticalWarnings'), value: `${metrics.criticalIssues} / ${metrics.warningIssues}`, tone: 'text-amber-200' },
        { label: t('crawl.ui.indexable'), value: metrics.indexable, tone: 'text-sky-300' },
        { label: t('crawlDirectoryUi.averageHttpWords'), value: `${metrics.averageResponseMs === null ? '—' : `${metrics.averageResponseMs} ${t('performance.milliseconds')}`} / ${metrics.words}`, tone: 'text-violet-200' },
      ].map((item) => <div key={item.label} className="min-w-0 rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-2"><p className="truncate text-[10px] text-slate-500">{item.label}</p><p className={`mt-1 truncate font-mono text-sm font-semibold ${item.tone}`}>{item.value}</p></div>)}
    </div>

    {tree.ignoredPageCount > 0 && <p role="status" className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-100">{t('crawlDirectoryUi.ignored', { count: tree.ignoredPageCount })}</p>}
    {!tree.pageCount ? <p className="rounded-lg border border-dashed border-slate-800 p-5 text-center text-xs text-slate-500">{t('crawlDirectoryUi.noPages')}</p> : <ul className="max-h-[560px] overflow-auto rounded-lg border border-slate-800 bg-slate-950/35 p-2" aria-label={t('crawlDirectoryUi.catalogAria')}>{tree.roots.map(renderDirectory)}</ul>}

    <aside aria-live="polite" className="min-h-12 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      {selectedPage ? <><p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">{t('crawlDirectoryUi.selectedPage')}</p><p className="mt-1 break-all font-mono text-[11px] text-slate-200">{selectedPage.url}</p><p className="mt-1 text-[10px] text-slate-500">{statusLabel(selectedPage, t)} · {selectedPage.word_count} {t('crawlDirectoryUi.words')} · {selectedPage.response_time_ms} {t('performance.milliseconds')} · {selectedPage.indexability_status || t('crawlDirectoryUi.indexabilityUnknown')}</p></> : <p className="text-xs text-slate-500">{t('crawlDirectoryUi.selectedPageHint')}</p>}
    </aside>
  </div>;
};
