import { vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const mkStore = (state: Record<string, unknown>) => Object.assign((sel: (s: unknown) => unknown) => sel(state), { getState: () => state });
  const tools: Record<string, unknown> = {
    hydrateProject: vi.fn(), importScheduledCrawlResult: vi.fn(), savedKeywords: [1, 2], trackedRanks: [1], isCrawling: true, crawlProgress: 0.5, crawlRuns: [1, 2, 3],
  };
  const listeners: Array<() => void> = [];
  const unsubscribe = vi.fn();
  const toolsStore = Object.assign(mkStore(tools), { subscribe: vi.fn((fn: () => void) => { listeners.push(fn); return unsubscribe; }) });
  return {
    tools, toolsStore, listeners, unsubscribe,
    project: { activeProjectId: 'p1' as string | null },
    settings: { loadDataForSeoCredentials: vi.fn(), loadGoogleMetricsApiKey: vi.fn() },
    audit: { hydrateProject: vi.fn(), importScheduledAuditResult: vi.fn() },
    auth: { hydrateCredentials: vi.fn(), detectLocalClients: vi.fn(), hydrateProject: vi.fn() },
    indicators: { reset: vi.fn(), setSnapshot: vi.fn() },
    wake: { reconcile: vi.fn(), ack: vi.fn(), sync: vi.fn() },
    load: vi.fn(),
    mkStore,
  };
});
export const h = hoisted;
