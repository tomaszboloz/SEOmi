import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/services/tauri', () => ({ isTauriEnvironment: () => true, invokeTauriCommand: vi.fn() }));
vi.mock('@/services/desktopNotifications', () => ({ notifyCrawlCompleted: vi.fn() }));
vi.mock('@/components/Domain/siteAudit/siteAuditHelpers', () => ({ focusCrawlStartForm: vi.fn() }));

import { useToolsStore } from '@/stores/toolsStore';
import { useCrawlExecution } from '@/components/Domain/siteAudit/session/useCrawlExecution';
import type { CrawlReportTemplate } from '@/services/reportTemplates';

const template = { id: 't' } as unknown as CrawlReportTemplate;
const current = { id: 'current', environment: 'staging', startUrl: 'https://a.test/', result: { health_score: 80 } };
const other = { id: 'other', environment: 'production', startUrl: 'https://a.test/', result: { health_score: 70 } };
const report = { rows: [] };

const mount = (project: string | null, compareRuns: ReturnType<typeof vi.fn>) => {
  const services = { downloadPdf: vi.fn(), compare: vi.fn(), compareRuns } as never;
  return renderHook(({ id }) => useCrawlExecution(id, services, 'https://a.test/', 25, vi.fn().mockResolvedValue({ valid: true }), template), { initialProps: { id: project } });
};
const seed = (patch: Record<string, unknown>) => act(() => { useToolsStore.setState({ crawlResult: current.result, crawlRuns: [current, other], selectedCrawlRunId: 'current', isCrawling: false, ...patch } as never); });

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.clearAllMocks());

it('compares persisted runs through compareRuns with the active project and path matching', () => {
  const compareRuns = vi.fn().mockReturnValue(report);
  seed({});
  const view = mount('p1', compareRuns);
  act(() => view.result.current.setComparisonRunId('other'));
  expect(view.result.current.comparison).toBe(report);
  expect(compareRuns).toHaveBeenLastCalledWith(current, other, { projectId: 'p1', matchByPath: false });
});

it('omits the project id when no project is active', () => {
  const compareRuns = vi.fn().mockReturnValue(report);
  seed({});
  const view = mount(null, compareRuns);
  act(() => view.result.current.setComparisonRunId('other'));
  expect(compareRuns).toHaveBeenLastCalledWith(current, other, { projectId: undefined, matchByPath: false });
});

it('yields no comparison when the displayed crawl result belongs to no stored run', () => {
  const compareRuns = vi.fn().mockReturnValue(report);
  seed({ crawlResult: { health_score: 1 }, selectedCrawlRunId: null });
  const view = mount('p1', compareRuns);
  act(() => view.result.current.setComparisonRunId('other'));
  expect(view.result.current.comparison).toBeNull();
  expect(compareRuns).not.toHaveBeenCalled();
});
