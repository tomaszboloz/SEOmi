import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataForSEOClient, readDataForSeoTaskLog } from '../src/services/dataforseo';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

describe('DataForSEOClient', () => {
afterEach(() => vi.unstubAllGlobals());

it('keeps a failed task log bound to the project that started the request', async () => {
    localStorage.clear();
    localStorage.setItem('seomi_active_project_v1', 'request-source-project');
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal('fetch', fetchMock);

    const request = new DataForSEOClient('user', 'password').getSerpCompetitors('seo');
    await Promise.resolve();
    localStorage.setItem('seomi_active_project_v1', 'new-active-project');
    resolveFetch?.(new Response(JSON.stringify({ status_message: 'Authentication failed' }), { status: 401 }));

    await expect(request).rejects.toThrow('Authentication failed');
    expect(readDataForSeoTaskLog('request-source-project')).toEqual([
      expect.objectContaining({ projectId: 'request-source-project', statusCode: 401, ok: false }),
    ]);
    expect(readDataForSeoTaskLog('new-active-project')).toEqual([]);
  });

it('does not retry a native IPC quota response', async () => {
    localStorage.clear();
    localStorage.setItem('seomi_active_project_v1', 'native-quota-project');
    invokeMock.mockReset().mockRejectedValue(new Error('HTTP 429 quota exceeded: insufficient balance'));
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });

    try {
      await expect(new DataForSEOClient('user', 'password').getSerpCompetitors('seo')).rejects.toThrow(/quota exceeded/i);
      expect(invokeMock).toHaveBeenCalledTimes(1);
    } finally {
      delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
      invokeMock.mockReset();
    }
  });

it('persists provider task status, id, cost and duration per active project without secrets', async () => {
    localStorage.clear();
    localStorage.setItem('seomi_active_project_v1', 'project-task-log');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{
      id: 'task-123', status_code: 20000, status_message: 'Ok', cost: 0.0042, time: 0.37,
      result_count: 1, result: [{ items: [] }],
    }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await new DataForSEOClient('user', 'password').getSerpCompetitors('seo', 2840, 'en');

    expect(readDataForSeoTaskLog('project-task-log')).toEqual([
      expect.objectContaining({
        projectId: 'project-task-log',
        endpoint: '/v3/serp/google/organic/live/regular',
        taskId: 'task-123',
        statusCode: 20000,
        cost: 0.0042,
        timeSeconds: 0.37,
        resultCount: 1,
        ok: true,
      }),
    ]);
    const stored = localStorage.getItem('seomi_project_project-task-log_dataforseo_task_log_v1') || '';
    expect(stored).not.toContain('password');
    expect(stored).not.toContain('user');
  });

it('maps Domain Labs metrics and relevant pages from their documented response fields', async () => {
    const requests: Array<{ url: string; body?: Record<string, unknown>[] }> = [];
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown>[] : undefined;
      requests.push({ url, body });
      let items: Record<string, unknown>[] = [];
      if (url.includes('/domain_rank_overview/')) items = [{ metrics: { organic: { etv: 1200, count: 60 } } }];
      if (url.includes('/ranked_keywords/')) items = [{
        keyword_data: { keyword: 'seo audit', keyword_info: { search_volume: 900 }, search_intent_info: { main_intent: 'informational' } },
        ranked_serp_element: { serp_item: { rank_absolute: 4, etv: 240 } },
      }];
      if (url.includes('/relevant_pages/')) items = [{ page_address: 'https://example.com/audit', metrics: { organic: { etv: 600, count: 12 } } }];
      if (url.includes('/competitors_domain/')) items = [{ domain: 'competitor.example', intersections: 14, avg_position: 13.4 }];
      const result = url.includes('/backlinks/summary/')
        ? [{ backlinks: 50, referring_domains: 10, referring_main_domains: 9, rank: 35, dofollow: 20, broken_backlinks: 0 }]
        : [{ items }];
      return new Response(JSON.stringify({ tasks: [{ status_code: 20000, result }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const overview = await new DataForSEOClient('user', 'password').getDomainOverview('example.com', 2616);

    expect(overview).toMatchObject({
      organic_traffic: 1200,
      organic_keywords: 60,
      top_keywords: [{ keyword: 'seo audit', position: 4, search_volume: 900, traffic_share: 20, intent: 'Informational' }],
      top_pages: [{ url: 'https://example.com/audit', traffic_percentage: 50, keywords_count: 12 }],
      competitors: [{ domain: 'competitor.example', common_keywords: 14, average_position: 13.4 }],
    });
    expect(requests.some(({ url }) => url.includes('/relevant_pages/live'))).toBe(true);
  });

it('keeps missing domain metrics empty instead of presenting them as real zeroes', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      const url = String(input);
      if (url.includes('/backlinks/summary/')) return new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [] }] }), { status: 200 });
      const items = url.includes('/domain_rank_overview/') ? [{ metrics: {} }] : [];
      return new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items }] }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const overview = await new DataForSEOClient('user', 'password').getDomainOverview('example.com', 2840);

    expect(overview).toMatchObject({ organic_traffic: null, organic_keywords: null, domain_rank: null, referring_domains: null });
  });
});
