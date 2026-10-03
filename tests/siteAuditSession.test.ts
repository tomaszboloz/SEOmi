import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';
import { focusCrawlStartForm, formatCrawlElapsed } from '@/components/Domain/siteAudit/siteAuditHelpers';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { invokeTauriCommand } from '@/services/tauri';
import { importUrlsFromCsv } from '@/services/csvUrls';
import { compareCrawlResults } from '@/services/crawlDiff';
import { downloadCrawlPdf } from '@/services/export';

const tools = useToolsStore.getState();
const projects = useProjectStore.getState();
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'session-test' }); useToolsStore.setState({ crawlRuns: [], crawlResult: null }); });
afterEach(() => { useToolsStore.setState(tools); useProjectStore.setState(projects); vi.unstubAllGlobals(); });

it.each([[undefined, '0:00'], [-1, '0:00'], [61_200, '1:01']])('formats elapsed time %s', (value, expected) => {
  expect(formatCrawlElapsed(value)).toBe(expected);
});

it('imports explicit CSV seed evidence through its injectable service', async () => {
  const importUrls = vi.fn(importUrlsFromCsv);
  const { result } = renderHook(() => useSiteAuditSession({ invoke: invokeTauriCommand, importUrls, compare: compareCrawlResults, downloadPdf: downloadCrawlPdf }));
  const file = new File(['https://example.com/page'], 'urls.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: async () => 'https://example.com/page' });
  await act(async () => result.current.importSeedUrls(file));
  expect(importUrls).toHaveBeenCalledWith('https://example.com/page');
  expect(useToolsStore.getState().crawlConfig.seedUrls).toEqual(['https://example.com/page']);
});

it('can request focus with an absent form without crashing', () => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  expect(() => focusCrawlStartForm()).not.toThrow();
});
