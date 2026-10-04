import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCrawlFormState } from '@/components/Domain/siteAudit/session/useCrawlFormState';
import { useToolsStore } from '@/stores/toolsStore';
import { DEFAULT_CRAWL_CONFIG } from '@/services/contracts/crawlDefaults';

export function formHook() {
  const setCrawlConfig = vi.fn();
  const saveCrawlRequestProfile = vi.fn();
  const deleteCrawlRequestProfile = vi.fn();
  useToolsStore.setState({ crawlUrl: 'https://example.test', crawlLimit: 25,
    crawlConfig: { ...DEFAULT_CRAWL_CONFIG, requestProfileId: 'profile' },
    crawlRequestProfiles: [], setCrawlConfig, saveCrawlRequestProfile, deleteCrawlRequestProfile });
  const services = { invoke: vi.fn(), importUrls: vi.fn(() => ({ urls: ['https://new.test'], rejected: ['bad'] })), compare: vi.fn(), downloadPdf: vi.fn() };
  const hook = renderHook(({ project }) => useCrawlFormState(project, services), { initialProps: { project: 'one' } });
  return { ...hook, services, setCrawlConfig, saveCrawlRequestProfile, deleteCrawlRequestProfile };
}
