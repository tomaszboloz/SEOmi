import { z } from 'zod';
import { readJsonStorage } from '@/services/storage';
import { type CrawlLinkKindFilter, type CrawlLinkSort, type CrawlLinkStatusFilter } from '@/services/crawlLinkFilters';
import { type CrawlTab, type CrawlTabGroup, tabs, tabGroupForTab } from './crawlResultsTabsConfig';
import { type MetadataFacet, metadataFacetIds } from './crawlResultsMetadata';
import type { CrawlFilterPreset } from './crawlResultsFormatters';

export interface CrawlNavigationPreferences {
  activeTab: CrawlTab;
  activeTabGroup: CrawlTabGroup;
  metadataFacet: MetadataFacet;
  validationQuery: string;
  validationSeverity: 'all' | 'Error' | 'Warning';
}

export const emptyCrawlNavigationPreferences = (): CrawlNavigationPreferences => ({
  activeTab: 'overview',
  activeTabGroup: 'core',
  metadataFacet: 'all',
  validationQuery: '',
  validationSeverity: 'all',
});

export const readCrawlNavigationPreferences = (
  key: string | null,
): CrawlNavigationPreferences => {
  if (!key) return emptyCrawlNavigationPreferences();
  try {
    const parsed: unknown = readJsonStorage(key, null);
    if (!parsed || typeof parsed !== 'object')
      return emptyCrawlNavigationPreferences();
    const candidate = parsed as Partial<CrawlNavigationPreferences>;
    const activeTab = tabs.some((tab) => tab.id === candidate.activeTab)
      ? (candidate.activeTab as CrawlTab)
      : 'overview';
    return {
      activeTab,
      activeTabGroup: tabGroupForTab(activeTab),
      metadataFacet: metadataFacetIds.has(
        candidate.metadataFacet as MetadataFacet,
      )
        ? (candidate.metadataFacet as MetadataFacet)
        : 'all',
      validationQuery:
        typeof candidate.validationQuery === 'string'
          ? candidate.validationQuery.slice(0, 120)
          : '',
      validationSeverity:
        candidate.validationSeverity === 'Error' ||
        candidate.validationSeverity === 'Warning'
          ? candidate.validationSeverity
          : 'all',
    };
  } catch {
    return emptyCrawlNavigationPreferences();
  }
};

export interface CrawlLinkNavigationPreferences {
  query: string;
  kind: CrawlLinkKindFilter;
  status: CrawlLinkStatusFilter;
  sort: CrawlLinkSort;
  descending: boolean;
}

export const emptyCrawlLinkNavigationPreferences =
  (): CrawlLinkNavigationPreferences => ({
    query: '',
    kind: 'all',
    status: 'all',
    sort: 'source',
    descending: false,
  });

export const readCrawlLinkNavigationPreferences = (
  key: string | null,
): CrawlLinkNavigationPreferences => {
  if (!key) return emptyCrawlLinkNavigationPreferences();
  const parsed = readJsonStorage(key, null);
  if (!parsed || typeof parsed !== 'object')
    return emptyCrawlLinkNavigationPreferences();
  const candidate = parsed as Partial<CrawlLinkNavigationPreferences>;
  return {
    query:
      typeof candidate.query === 'string' ? candidate.query.slice(0, 160) : '',
    kind:
      candidate.kind === 'internal' || candidate.kind === 'external'
        ? candidate.kind
        : 'all',
    status: ['unchecked', 'ok', 'redirect', 'error', 'blocked'].includes(
      candidate.status || '',
    )
      ? (candidate.status as CrawlLinkStatusFilter)
      : 'all',
    sort:
      candidate.sort === 'target' ||
      candidate.sort === 'anchor' ||
      candidate.sort === 'status'
        ? candidate.sort
        : 'source',
    descending: candidate.descending === true,
  };
};

export const filterPresetsKey = (projectId: string) =>
  `seomi_project_${projectId}_crawl_filter_presets_v1`;

export const loadFilterPresets = (projectId: string): CrawlFilterPreset[] => {
  try {
    const value: unknown = readJsonStorage(
      filterPresetsKey(projectId),
      [],
    );
    const schema = z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(60),
      severity: z.enum(['all', 'Critical', 'Warning', 'Info']),
      errorKind: z.string().default('all'),
      segment: z.enum(['all', '2xx', '3xx', '4xx', '5xx', 'transport']),
      onlyProblems: z.boolean(),
      query: z.string().default(''),
      sort: z.enum(['url', 'status', 'title', 'depth', 'responseTime', 'issues']),
      descending: z.boolean().default(false),
    });
    return Array.isArray(value)
      ? value.slice(0, 30).flatMap((item) => {
          const result = schema.safeParse(item);
          return result.success ? [result.data as CrawlFilterPreset] : [];
        })
      : [];
  } catch {
    return [];
  }
};
