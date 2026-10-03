import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToolsStore } from '@/stores/toolsStore';

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

it('can force a fresh check for targets that already have a result', async () => {
    const checkedRun = JSON.parse(JSON.stringify(run));
    checkedRun.result.pages[0].links[0].target_checked_at = '2026-09-22T12:01:00.000Z';
    checkedRun.result.pages[0].links[0].target_http_status = 504;
    checkedRun.result.pages[0].links[1].target_checked_at = '2026-09-22T12:01:00.000Z';
    checkedRun.result.pages[0].links[1].target_http_status = 200;
    checkedRun.result.pages[0].links[2].target_checked_at = '2026-09-22T12:01:00.000Z';
    checkedRun.result.pages[0].links[2].target_request_error_kind = 'timeout';
    useToolsStore.setState({ crawlRuns: [checkedRun], crawlResult: checkedRun.result });
    invokeTauriCommand.mockResolvedValue({
      requested: 3, checked: 3, omitted: 0,
      results: [
        { url: 'https://outside.example/broken', httpStatus: 200, checkedAt: '2026-09-22T12:02:00.000Z' },
        { url: 'http://127.0.0.1/admin', requestErrorKind: 'blocked', checkedAt: '2026-09-22T12:02:01.000Z' },
      ],
    });

    await useToolsStore.getState().checkCrawlExternalLinks(run.id, 100, true);

    expect(invokeTauriCommand).toHaveBeenCalledWith('check_external_crawl_links', expect.objectContaining({
      urls: ['https://outside.example/broken', 'http://127.0.0.1/admin'],
      maxUrls: 100,
    }));
    expect(useToolsStore.getState().crawlRuns[0].result.pages[0].links[0].target_http_status).toBe(200);
    expect(useToolsStore.getState().crawlRuns[0].result.pages[0].links[2].target_request_error_kind).toBe('blocked');
  });
});
