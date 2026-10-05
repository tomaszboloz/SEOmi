import type { CrawledDiscoverySource, CrawledPageSummary, RenderedPageArtifact } from '@/types';
import type { CrawlResourceProvenanceStatus } from '@/services/crawlResources';
import { downloadBlob } from '@/services/download';
import { appLocale } from '@/services/localeFormat';

export type CrawlSegment = 'all' | '2xx' | '3xx' | '4xx' | '5xx' | 'transport';

export type CrawlSort =
  | 'url'
  | 'status'
  | 'title'
  | 'depth'
  | 'responseTime'
  | 'issues';

export type ResourceProvenanceFilter = 'all' | CrawlResourceProvenanceStatus;

export interface CrawlFilterPreset {
  id: string;
  name: string;
  severity: 'all' | 'Critical' | 'Warning' | 'Info';
  errorKind: string;
  segment: CrawlSegment;
  onlyProblems: boolean;
  query: string;
  sort: CrawlSort;
  descending: boolean;
}

export const cell = 'px-3 py-2 align-top';

export const tableHead =
  'sticky top-0 bg-slate-950 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500';

export const tableWrap =
  'max-h-[min(62vh,680px)] overflow-auto rounded-lg border border-slate-800';

export const downloadRenderedArtifact = (artifact: RenderedPageArtifact): void => {
  const binary = atob(artifact.dataBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  downloadBlob(artifact.fileName, new Blob([bytes], { type: artifact.contentType }));
};

export const formatNumber = (value: number): string =>
  Math.round(value).toLocaleString(appLocale());

export const normalizeLinkUrl = (value: string): string => {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return value.trim();
  }
};

export const optional = (value?: string | number | null): string =>
  value == null || value === '' ? '—' : String(value);

export const discoverySourcesForPage = (
  page: CrawledPageSummary,
): CrawledDiscoverySource[] => page.discovery_sources || [];
