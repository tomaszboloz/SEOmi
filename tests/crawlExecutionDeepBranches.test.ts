import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const desktop = vi.hoisted(() => ({ value: true }));
vi.mock('@/services/tauri', () => ({ isTauriEnvironment: () => desktop.value }));
vi.mock('@/services/desktopNotifications', () => ({ notifyCrawlCompleted: vi.fn() }));
vi.mock('@/components/Domain/siteAudit/siteAuditHelpers', () => ({ focusCrawlStartForm: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import { useToolsStore } from '@/stores/toolsStore';
import { useCrawlExecution } from '@/components/Domain/siteAudit/session/useCrawlExecution';
import type { CrawlReportTemplate } from '@/services/reportTemplates';

const services = { downloadPdf: vi.fn(), compare: vi.fn() } as never;
const template = { id: 't' } as unknown as CrawlReportTemplate;
const mount = (project: string | null = 'p1') =>
  renderHook(({ id }) => useCrawlExecution(id, services, 'https://a.test', 25, vi.fn().mockResolvedValue({ valid: true }), template), { initialProps: { id: project } });
const seedTools = (patch: Record<string, unknown> = {}) => act(() => useToolsStore.setState({ crawlResult: null, crawlRuns: [], isCrawling: false, selectedCrawlRunId: null, crawlError: null, ...patch } as never));

describe('crawlExecution deep branches', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    seedTools();
  });

  it('handles missing staging run in environment comparison', async () => {
    seedTools({ startSiteCrawl: vi.fn().mockResolvedValue(null), crawlError: 'boom' });
    const view = mount();
    await act(async () => {
      view.result.current.updateEnvironmentUrl('staging', 'https://s.test');
    });
    await act(async () => {
      view.result.current.updateEnvironmentUrl('production', 'https://p.test');
    });

    await act(async () => {
      await view.result.current.runEnvironmentComparison();
    });

    expect(view.result.current.environmentComparisonError).toBe('boom');
    expect(view.result.current.isEnvironmentComparisonRunning).toBe(false);
  });
});
