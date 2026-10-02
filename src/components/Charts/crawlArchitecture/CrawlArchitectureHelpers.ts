import { z } from 'zod';
import { readJsonRecord, parseRecordEntries } from '@/services/storageContracts';
import type { SemanticMapPreferences } from './CrawlArchitectureTypes';

export const emptyPreferences = (): SemanticMapPreferences => ({ query: '', clusterFilter: 'all', orphansOnly: false, linkMode: 'content', selectedUrl: null, activeView: 'graph', positions: {}, transform: { x: 0, y: 0, k: 1 } });

export const readPreferences = (key: string | null): SemanticMapPreferences => {
  if (!key) return emptyPreferences();
  try {
    const parsed = readJsonRecord(key);
    if (!parsed) return emptyPreferences();
    const positions = Object.fromEntries(Object.entries(parseRecordEntries(parsed.positions, z.object({ x: z.number().finite(), y: z.number().finite() }))).filter(([, point]) =>
      point && Number.isFinite(point.x) && Number.isFinite(point.y),
    ).slice(0, 160));
    return {
      query: typeof parsed.query === 'string' ? parsed.query.slice(0, 200) : '',
      clusterFilter: typeof parsed.clusterFilter === 'string' ? parsed.clusterFilter : 'all',
      orphansOnly: parsed.orphansOnly === true,
      linkMode: parsed.linkMode === 'all' ? 'all' : 'content',
      selectedUrl: typeof parsed.selectedUrl === 'string' ? parsed.selectedUrl : null,
      activeView: parsed.activeView === 'directory' || parsed.activeView === 'plan' ? parsed.activeView : 'graph',
      positions,
      transform: z.object({ x: z.number().finite(), y: z.number().finite(), k: z.number().finite().min(0.2).max(4) }).catch({ x: 0, y: 0, k: 1 }).parse(parsed.transform),
    };
  } catch {
    return emptyPreferences();
  }
};

export const shortUrl = (value: string): string => {
  try { const url = new URL(value); return `${url.pathname}${url.search}` || '/'; } catch { return value; }
};

export const discoveryLabel = (kind: string, translate: (key: string) => string): string => ({
  start: translate('mapUi.discovery.start'),
  seed: translate('mapUi.discovery.seed'),
  sitemap: translate('mapUi.discovery.sitemap'),
  link: translate('mapUi.discovery.link'),
}[kind] ?? kind);

export const scrollMapTabs = (direction: 'left' | 'right', ref: React.RefObject<HTMLDivElement | null>) => {
  ref.current?.scrollBy?.({
    left: direction === 'left' ? -260 : 260,
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth',
  });
};

export const returnToResults = () => {
  const results = document.getElementById('crawl-results');
  results?.scrollIntoView({
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth',
    block: 'start',
  });
  if (results instanceof HTMLElement) results.focus({ preventScroll: true });
};

export const returnToMapStart = () => {
  const mapSection = document.getElementById('crawl-map-section');
  mapSection?.scrollIntoView({
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth',
    block: 'start',
  });
  if (mapSection instanceof HTMLElement) mapSection.focus({ preventScroll: true });
};
