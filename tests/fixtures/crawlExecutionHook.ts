import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCrawlExecution } from '@/components/Domain/siteAudit/session/useCrawlExecution';
import { useToolsStore } from '@/stores/toolsStore';
import { DEFAULT_CRAWL_REPORT_TEMPLATE } from '@/services/reportTemplates';
import { isTauriEnvironment } from '@/services/tauri';

export function executionHook(project: string | null = 'hook-project', input = ' https://example.test ', valid: boolean | null = true) {
  localStorage.clear();
  const startSiteCrawl = vi.fn();
  const setCrawlUrl = vi.fn();
  const setCrawlLimit = vi.fn();
  useToolsStore.setState({ crawlRuns: [], crawlResult: null, isCrawling: false, selectedCrawlRunId: null, crawlError: null, startSiteCrawl, setCrawlUrl, setCrawlLimit });
  const services = { invoke: vi.fn(), importUrls: vi.fn(), compare: vi.fn(), downloadPdf: vi.fn() };
  const validate = vi.fn(async () => valid === null ? null : { valid });
  const hook = renderHook(({ project }) => useCrawlExecution(project, services, input, 25, validate, DEFAULT_CRAWL_REPORT_TEMPLATE), { initialProps: { project } });
  return { ...hook, services, validate, startSiteCrawl, setCrawlUrl, setCrawlLimit };
}

export function desktop(available = true) { vi.mocked(isTauriEnvironment).mockReturnValue(available); }
