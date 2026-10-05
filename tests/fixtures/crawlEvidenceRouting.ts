import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useCrawlEvidenceRouting } from '@/components/Domain/crawlResults/session/useCrawlEvidenceRouting';
import { createCrawlRunFixture } from './crawl';

export const source = 'https://example.test/source?a=1&b=2';
export const target = 'https://example.test/target#section';
export function setEvidenceHash(values: Record<string, string> = {}) {
  history.replaceState(null, '', `#crawl-evidence?${new URLSearchParams({ project: 'one', run: 'run', url: source, ...values })}`);
}
export function dispatchHash() { act(() => window.dispatchEvent(new Event('hashchange'))); }
export function frameQueue() {
  const callbacks: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { callbacks.push(callback); return callbacks.length; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  return { callbacks, flush: (index: number) => act(() => callbacks[index](0)) };
}
export function routingProps(links = false) {
  return {
    activeProjectId: 'one' as string | null, runs: [createCrawlRunFixture({ id: 'run' })], onSelectRun: vi.fn(),
    tabNav: { activeTab: links ? 'links' : 'urls', setActiveTab: vi.fn() },
    filterState: {
      setLinkQuery: vi.fn(), setLinkKind: vi.fn(), setLinkStatus: vi.fn(), setLinkEvidence: vi.fn(),
      setSeverity: vi.fn(), setErrorKind: vi.fn(), setSegment: vi.fn(), setOnlyProblems: vi.fn(),
      setQuery: vi.fn(), setEvidenceUrl: vi.fn(), linkEvidence: links ? { source, target } : null,
    },
    navigationRunId: 'run', pages: [] as unknown[],
  };
}
export function setupRouting(links = false) {
  const props = routingProps(links);
  return { ...renderHook(useCrawlEvidenceRouting, { initialProps: props }), props };
}
export function urlRow(url = source) {
  const row = document.createElement('div'); row.id = `crawl-row-${encodeURIComponent(url)}`;
  row.scrollIntoView = vi.fn(); document.body.append(row); return row;
}
export function linkRow(linkSource = source, linkTarget = target) {
  const row = document.createElement('div'); row.dataset.crawlLinkRow = '1';
  row.dataset.sourceUrl = linkSource; row.dataset.targetUrl = linkTarget;
  row.scrollIntoView = vi.fn(); document.body.append(row); return row;
}
