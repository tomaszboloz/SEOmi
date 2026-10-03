import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToolsStore } from '@/stores/toolsStore';
import i18n from '@/i18n';
import { run } from "./fixtures/externalLinkCheckContracts";
const { invokeTauriCommand } = vi.hoisted(() => ({ invokeTauriCommand: vi.fn() }));

vi.mock('@/services/tauri', () => ({ invokeTauriCommand, isTauriEnvironment: () => false }));

describe('external crawl link checks', () => {
beforeEach(() => {
    localStorage.clear();
    invokeTauriCommand.mockReset();
    localStorage.setItem('seomi_active_project_v1', 'project-link-check');
    useToolsStore.setState({
      crawlRuns: [run as never], crawlResult: run.result as never,
      selectedCrawlRunId: run.id, isCheckingCrawlExternalLinks: false,
      crawlExternalLinkCheckError: null,
    });
  });

it('deduplicates normalized targets, saves factual HTTP data and reports broken targets on source pages', async () => {
    invokeTauriCommand.mockResolvedValue({
      requested: 2, checked: 2, omitted: 0,
      results: [
        { url: 'https://outside.example/broken', httpStatus: 404, responseTimeMs: 84, checkedAt: '2026-09-22T12:01:00.000Z' },
        { url: 'http://127.0.0.1/admin', requestErrorKind: 'blocked', checkedAt: '2026-09-22T12:01:01.000Z' },
      ],
    });

    await useToolsStore.getState().checkCrawlExternalLinks(run.id, 100);

    expect(invokeTauriCommand).toHaveBeenCalledWith('check_external_crawl_links', expect.objectContaining({
      requestId: expect.any(String), urls: ['https://outside.example/broken', 'http://127.0.0.1/admin'], maxUrls: 100,
    }));
    const state = useToolsStore.getState();
    const savedRun = state.crawlRuns[0];
    expect(savedRun.result.pages[0].links[0]).toMatchObject({ target_http_status: 404, target_response_time_ms: 84 });
    expect(savedRun.result.pages[0].links[0].target_checked_at).toBeTruthy();
    expect(savedRun.result.pages[0].links[1].target_http_status).toBe(404);
    expect(savedRun.result.pages[0].links[2]).toMatchObject({ target_request_error_kind: 'blocked' });
    expect(savedRun.result.pages[0].issues).toEqual([expect.objectContaining({
      severity: 'Warning', message: expect.stringContaining('1 external target(s)'),
    })]);
    expect(savedRun.result.warning_count).toBe(1);
    expect(JSON.parse(localStorage.getItem('seomi_project_project-link-check_crawl_runs') || '[]')[0].result.pages[0].links[0].target_http_status).toBe(404);
  });

it('leaves omitted targets explicitly unchecked and reports the remaining count', async () => {
    invokeTauriCommand.mockResolvedValue({
      requested: 2, checked: 1, omitted: 1,
      results: [{ url: 'https://outside.example/broken', httpStatus: 301, redirectUrl: 'https://new.example/', responseTimeMs: 32, checkedAt: '2026-09-22T12:01:00.000Z' }],
    });

    await useToolsStore.getState().checkCrawlExternalLinks(run.id, 1);

    const state = useToolsStore.getState();
    expect(state.crawlRuns[0].result.pages[0].links[0].target_redirect_url).toBe('https://new.example/');
    expect(state.crawlRuns[0].result.pages[0].links[2].target_checked_at).toBeUndefined();
    expect(state.crawlExternalLinkCheckError).toBe(i18n.t('runtimeErrors.tools.externalCheckSummary', { checked: 1, requested: 2, omitted: 1 }));
  });

it('persists to the originating project without overwriting state after a project switch', async () => {
    // A completed crawl is durable before an external check starts. Seed the
    // origin project's history so the switch exercises the real persistence
    // path instead of an in-memory-only fixture.
    localStorage.setItem('seomi_project_project-link-check_crawl_runs', JSON.stringify([run]));
    let resolveBatch!: (value: unknown) => void;
    invokeTauriCommand.mockReturnValue(new Promise((resolve) => { resolveBatch = resolve; }));
    const pending = useToolsStore.getState().checkCrawlExternalLinks(run.id, 100);
    await Promise.resolve();

    localStorage.setItem('seomi_active_project_v1', 'project-other');
    useToolsStore.setState({ crawlRuns: [], crawlResult: null, selectedCrawlRunId: null });
    resolveBatch({
      requested: 2, checked: 2, omitted: 0,
      results: [{ url: 'https://outside.example/broken', httpStatus: 404, checkedAt: '2026-09-22T12:01:00.000Z' }],
    });
    await pending;

    expect(useToolsStore.getState().crawlRuns).toEqual([]);
    expect(JSON.parse(localStorage.getItem('seomi_project_project-link-check_crawl_runs') || '[]')[0].result.pages[0].links[0].target_http_status).toBe(404);
  });

it('does not resurrect a run deleted while checks are in flight', async () => {
    let resolveBatch!: (value: unknown) => void;
    invokeTauriCommand.mockReturnValue(new Promise((resolve) => { resolveBatch = resolve; }));
    const pending = useToolsStore.getState().checkCrawlExternalLinks(run.id, 100);
    await Promise.resolve();

    // Model deleting the selected run before the delayed native response
    // arrives. The response must not rebuild the run from its start snapshot.
    useToolsStore.setState({ crawlRuns: [], crawlResult: null, selectedCrawlRunId: null });
    localStorage.removeItem('seomi_project_project-link-check_crawl_runs');
    resolveBatch({
      requested: 2, checked: 2, omitted: 0,
      results: [{ url: 'https://outside.example/broken', httpStatus: 404, checkedAt: '2026-09-22T12:01:00.000Z' }],
    });
    await pending;

    expect(useToolsStore.getState().crawlRuns).toEqual([]);
    expect(localStorage.getItem('seomi_project_project-link-check_crawl_runs')).toBeNull();
    expect(useToolsStore.getState().crawlExternalLinkCheckError).toBe(
      i18n.t('runtimeErrors.tools.runUnavailable'),
    );
  });

it('does not clear a newer same-project link check when an older response arrives', async () => {
    let resolveBatch!: (value: unknown) => void;
    invokeTauriCommand.mockReturnValue(new Promise((resolve) => { resolveBatch = resolve; }));
    const pending = useToolsStore.getState().checkCrawlExternalLinks(run.id, 100);
    await Promise.resolve();

    // A second check has replaced the progress token while the first native
    // request is still in flight.
    useToolsStore.setState({
      isCheckingCrawlExternalLinks: true,
      crawlExternalLinkCheckProgress: { requestId: 'new-request', completed: 1, total: 2, currentUrl: 'https://outside.example/new' },
    });
    resolveBatch({
      requested: 2, checked: 2, omitted: 0,
      results: [{ url: 'https://outside.example/broken', httpStatus: 404, checkedAt: '2026-09-22T12:01:00.000Z' }],
    });
    await pending;

    expect(useToolsStore.getState()).toMatchObject({
      isCheckingCrawlExternalLinks: true,
      crawlExternalLinkCheckProgress: { requestId: 'new-request' },
    });
  });
});
