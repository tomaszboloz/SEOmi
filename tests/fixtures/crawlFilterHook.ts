import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCrawlErrorFilters } from '@/components/Domain/siteAudit/session/useCrawlErrorFilters';
import { useToolsStore } from '@/stores/toolsStore';
import { DEFAULT_CRAWL_CONFIG } from '@/services/contracts/crawlDefaults';
import type { CrawlFilterValidationResult } from '@/types';

export const filterVerdict = (valid = true): CrawlFilterValidationResult => ({ valid, errors: [], previews: [] });
export function filterHook() {
  const setCrawlConfig = vi.fn();
  useToolsStore.setState({ crawlConfig: { ...DEFAULT_CRAWL_CONFIG, seedUrls: [] }, crawlResult: null, setCrawlConfig });
  const services = { invoke: vi.fn(), importUrls: vi.fn(), compare: vi.fn(), downloadPdf: vi.fn() };
  const hook = renderHook(({ project, url }) => useCrawlErrorFilters(url, project, services), { initialProps: { project: 'one', url: ' https://example.test ' } });
  return { ...hook, services, setCrawlConfig };
}
