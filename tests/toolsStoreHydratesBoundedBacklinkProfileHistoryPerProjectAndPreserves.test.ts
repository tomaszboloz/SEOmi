import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';

import { useToolsStore } from '../src/stores/toolsStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';

vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: vi.fn(),
  isTauriEnvironment: vi.fn(() => false),
  getSecureValue: vi.fn(async () => ''),
}));

describe('toolsStore', () => {
beforeEach(() => {
    localStorage.clear();
    vi.mocked(invokeTauriCommand).mockReset();
    vi.mocked(isTauriEnvironment).mockReturnValue(false);
    useToolsStore.setState({ keywordResults: [], keywordResultsSource: null, keywordError: null, crawlRuns: [], crawlResult: null, selectedCrawlRunId: null, backlinkProfileHistory: [] });
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
  });

afterEach(() => vi.unstubAllGlobals());

it('hydrates bounded backlink profile history per project and preserves null metrics', async () => {
    const projectId = 'project-backlink-history';
    localStorage.setItem('seomi_active_project_v1', projectId);
    const history = [
      {
        domain: 'example.com', retrieved_at: '2026-09-20T12:00:00.000Z', total_backlinks: 100,
        referring_domains: 10, domain_rank: 20, dofollow_ratio: null,
      },
      {
        domain: 'example.com', retrieved_at: '2026-09-21T12:00:00.000Z', total_backlinks: 140,
        referring_domains: 12, domain_rank: 22, dofollow_ratio: 65.5,
      },
      { domain: 'other.example', retrieved_at: '2026-09-21T12:00:00.000Z', total_backlinks: 1, referring_domains: 1, domain_rank: 1, dofollow_ratio: 100 },
      { domain: 'invalid.example', retrieved_at: 42, total_backlinks: 1, referring_domains: 1, domain_rank: 1, dofollow_ratio: 100 },
    ];
    localStorage.setItem(`seomi_project_${projectId}_backlink_profile_history_v1`, JSON.stringify(history));

    await useToolsStore.getState().hydrateProject(projectId);

    expect(useToolsStore.getState().backlinkProfileHistory).toHaveLength(3);
    expect(useToolsStore.getState().backlinkProfileHistory[0].dofollow_ratio).toBeNull();
    expect(useToolsStore.getState().backlinkProfileHistory[1].total_backlinks).toBe(140);
  });

it('does not apply a live domain response after the active project changes', async () => {
    const firstProject = 'project-live-one';
    const secondProject = 'project-live-two';
    useProjectStore.setState({
      projects: [
        { id: firstProject, name: 'Live one', rootUrl: 'https://one.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
        { id: secondProject, name: 'Live two', rootUrl: 'https://two.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
      ],
      activeProjectId: firstProject,
    });
    localStorage.setItem('seomi_active_project_v1', firstProject);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'user', password: 'secret' } });

    let releaseFirstRequest: ((response: Response) => void) | undefined;
    let firstRequest = true;
    const fetchMock = vi.fn((input: string) => {
      const url = String(input);
      const items = url.includes('/domain_rank_overview/') ? [{ metrics: { organic: { etv: 1200, count: 60 } } }] : [];
      const result = url.includes('/backlinks/summary/')
        ? [{ backlinks: 40, referring_domains: 8, rank: 25, dofollow: 20, broken_backlinks: 0 }]
        : [{ items }];
      const response = new Response(JSON.stringify({ tasks: [{ status_code: 20000, result }] }), { status: 200 });
      if (firstRequest) {
        firstRequest = false;
        return new Promise<Response>((resolve) => { releaseFirstRequest = resolve; });
      }
      return Promise.resolve(response);
    });
    vi.stubGlobal('fetch', fetchMock);

    const pending = useToolsStore.getState().analyzeDomain('one.example');
    localStorage.setItem('seomi_active_project_v1', secondProject);
    useProjectStore.setState({ activeProjectId: secondProject });
    await useToolsStore.getState().hydrateProject(secondProject);
    releaseFirstRequest?.(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items: [{ metrics: { organic: { etv: 1200, count: 60 } } }] }] }] }), { status: 200 }));
    await pending;

    expect(useToolsStore.getState().domainOverview).toBeNull();
    expect(useToolsStore.getState().domainError).toBeNull();
  });

it('does not let a stale backlink page overwrite a newer profile request in the same project', async () => {
    const projectId = 'project-backlink-request-order';
    useProjectStore.setState({
      projects: [{ id: projectId, name: 'Backlink order', rootUrl: 'https://example.com', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }],
      activeProjectId: projectId,
    });
    localStorage.setItem('seomi_active_project_v1', projectId);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'user', password: 'secret' } });
    useToolsStore.setState({
      backlinkProfile: {
        domain: 'example.com', total_backlinks: 2, referring_domains: 1, referring_subnets: 1, domain_rank: 10,
        dofollow_ratio: 100, total_anchor_rows: 1, total_backlink_rows: 2,
        anchors: [{ anchor: 'old', count: 1, percentage: 50 }],
        backlinks: [{ source_title: 'Existing', source_url: 'https://existing.example/', target_url: 'https://example.com/', anchor_text: 'old', is_dofollow: true, domain_rank: 10, first_seen: '2026-01-01' }],
      },
      isBacklinkLoading: false,
    });

    let releaseStalePage!: (response: Response) => void;
    let backlinkPageCalls = 0;
    const response = (result: Record<string, unknown>[]) => new Response(JSON.stringify({ tasks: [{ status_code: 20000, result }] }), { status: 200 });
    const fetchMock = vi.fn((input: string) => {
      const url = String(input);
      if (url.includes('/backlinks/backlinks/')) {
        backlinkPageCalls += 1;
        if (backlinkPageCalls === 1) {
          return new Promise<Response>((resolve) => { releaseStalePage = resolve; });
        }
        return Promise.resolve(response([{ total_count: 2, items: [{ title: 'Fresh', url_from: 'https://fresh.example/', url_to: 'https://example.com/', anchor: 'fresh', dofollow: true, rank: 25, first_seen: '2026-02-01' }] }]));
      }
      if (url.includes('/backlinks/summary/')) {
        return Promise.resolve(response([{ backlinks: 2, referring_domains: 1, referring_main_domains: 1, rank: 15, dofollow: 2, broken_backlinks: 0 }]));
      }
      if (url.includes('/backlinks/anchors/')) {
        return Promise.resolve(response([{ total_count: 1, referring_subnets: 1, items: [{ anchor: 'fresh', backlinks: 2 }] }]));
      }
      return Promise.resolve(response([]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const stalePage = useToolsStore.getState().loadMoreBacklinks();
    await Promise.resolve();
    const freshProfile = useToolsStore.getState().analyzeBacklinks('example.com');
    await freshProfile;

    expect(useToolsStore.getState().backlinkProfile?.backlinks).toHaveLength(1);
    expect(useToolsStore.getState().backlinkProfile?.backlinks[0]?.source_url).toBe('https://fresh.example/');

    releaseStalePage(response([{ total_count: 2, items: [{ title: 'Stale', url_from: 'https://stale.example/', url_to: 'https://example.com/', anchor: 'stale', dofollow: true, rank: 5, first_seen: '2026-01-15' }] }]));
    await stalePage;

    expect(useToolsStore.getState().backlinkProfile?.backlinks).toHaveLength(1);
    expect(useToolsStore.getState().backlinkProfile?.backlinks[0]?.source_url).toBe('https://fresh.example/');
    expect(useToolsStore.getState().isBacklinkLoading).toBe(false);
  });
});
