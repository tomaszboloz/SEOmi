import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuditStore } from '../src/stores/auditStore';
import { DataForSEOBacklinkSummary, PageAuditData } from '../src/types';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { notifyAuditCompleted, notifyBatchCompleted } from '@/services/desktopNotifications';
import { useSettingsStore } from '@/stores/settingsStore';
import i18n from '@/i18n';

const dataForSeoMocks = vi.hoisted(() => ({
  getBacklinksSummary: vi.fn(),
  getSerpCompetitors: vi.fn(),
}));

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: vi.fn(() => false) }));
vi.mock('@/services/desktopNotifications', () => ({ notifyAuditCompleted: vi.fn(), notifyBatchCompleted: vi.fn() }));
vi.mock('@/services/dataforseo', async () => {
  const actual = await vi.importActual<typeof import('@/services/dataforseo')>('@/services/dataforseo');
  // Vitest 5 invokes this mock with `new`, so the implementation must be
  // constructible (an arrow function is not constructible).
  return {
    ...actual,
    DataForSEOClient: vi.fn().mockImplementation(function DataForSEOClientMock() {
      return dataForSeoMocks;
    }),
  };
});

describe('useAuditStore', () => {
  it('passes configured timeout, redirect limit and TLS verification to the native page audit', async () => {
    localStorage.setItem('seomi_active_project_v1', 'audit-options');
    const previous = useSettingsStore.getState().config;
    useSettingsStore.setState({ config: { ...previous, request_timeout_secs: 41, max_redirects: 2, verify_ssl: false } });
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);
    await useAuditStore.getState().startAudit(mockAudit.url);
    expect(invokeTauriCommand).toHaveBeenCalledWith('inspect_url', expect.objectContaining({ timeoutSecs: 41, maxRedirects: 2, verifySsl: false }));
    useSettingsStore.setState({ config: previous });
  });
  beforeEach(() => {
    localStorage.clear();
    useAuditStore.getState().clearAudit();
    useAuditStore.setState({ history: [], isLoading: false, batchItems: [], batchRejectedRows: [], isBatchRunning: false, isBatchStopping: false });
    vi.mocked(invokeTauriCommand).mockReset();
    vi.mocked(isTauriEnvironment).mockReturnValue(false);
    vi.mocked(notifyAuditCompleted).mockReset();
    vi.mocked(notifyBatchCompleted).mockReset();
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
    dataForSeoMocks.getBacklinksSummary.mockReset();
    dataForSeoMocks.getSerpCompetitors.mockReset();
    vi.unstubAllGlobals();
  });

  const mockAudit: PageAuditData = {
    url: 'https://example.com',
    final_url: 'https://example.com',
    timestamp: new Date().toISOString(),
    http_status: 200,
    response_time_ms: 120,
    redirect_chain: [],
    meta_tags: {
      title: 'Test Title',
      title_length: 10,
      description: 'Test Description',
      description_length: 16,
      other_tags: [],
    },
    open_graph: { all_tags: [] },
    twitter_card: { all_tags: [] },
    headings: {
      h1_count: 1,
      h1_texts: ['H1 Title'],
      hierarchy: [{ level: 1, text: 'H1 Title', children: [] }],
      has_valid_hierarchy: true,
      issues: [],
    },
    images: [],
    links: {
      total_links: 0,
      internal_links: 0,
      external_links: 0,
      nofollow_links: 0,
      links: [],
    },
    security_headers: { score: 90 },
    structured_data: [],
    technical: { hreflang_tags: [] },
    health_score: 95,
    issues: [],
    content_stats: {
      word_count: 150,
      reading_time_minutes: 1,
      text_ratio_percent: 15.0,
      top_keywords: [],
    },
  };


  it('passes all configured request options to every audit in an imported batch', async () => {
    localStorage.setItem('seomi_active_project_v1', 'batch-options');
    const previous = useSettingsStore.getState().config;
    useSettingsStore.setState({ config: { ...previous, request_timeout_secs: 29, max_redirects: 0, verify_ssl: false } });
    useAuditStore.getState().setSelectedUserAgent('custom-agent/2.0');
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);
    try {
      useAuditStore.getState().importAuditCsv('url\nhttps://example.com/a\nhttps://example.com/b');
      await useAuditStore.getState().startBatchAudits();
      const calls = vi.mocked(invokeTauriCommand).mock.calls.filter(([command]) => command === 'inspect_url');
      expect(calls).toHaveLength(2);
      for (const [, args] of calls) expect(args).toMatchObject({ timeoutSecs: 29, maxRedirects: 0, verifySsl: false, userAgent: 'custom-agent/2.0', requestId: expect.any(String) });
    } finally { useSettingsStore.setState({ config: previous }); }
  });

  it('keeps an explicit per-request user agent ahead of the selected default', async () => {
    localStorage.setItem('seomi_active_project_v1', 'explicit-agent');
    useAuditStore.getState().setSelectedUserAgent('googlebot_desktop');
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);
    await useAuditStore.getState().startAudit(mockAudit.url, 'explicit-agent/1.0');
    expect(invokeTauriCommand).toHaveBeenCalledWith('inspect_url', expect.objectContaining({ userAgent: 'explicit-agent/1.0' }));
  });

  it('starts without fabricated audit data', () => {
    const state = useAuditStore.getState();
    expect(state.currentAudit).toBeNull();
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('should set audit data properly', () => {
    useAuditStore.getState().setAuditData(mockAudit);
    const state = useAuditStore.getState();
    expect(state.currentAudit).toEqual(mockAudit);
    expect(state.currentAudit?.health_score).toBe(95);
  });

  it('should switch active tabs correctly including dataforseo', () => {
    const store = useAuditStore.getState();
    expect(store.activeTab).toBe('overview');

    store.setActiveTab('dataforseo');
    expect(useAuditStore.getState().activeTab).toBe('dataforseo');

    store.setActiveTab('security');
    expect(useAuditStore.getState().activeTab).toBe('security');

    store.setActiveTab('social');
    expect(useAuditStore.getState().activeTab).toBe('social');
  });

  it('should update search filter', () => {
    useAuditStore.getState().setSearchFilter('canonical');
    expect(useAuditStore.getState().searchFilter).toBe('canonical');
  });

  it('should update selected user agent preset', () => {
    useAuditStore.getState().setSelectedUserAgent('googlebot_desktop');
    expect(useAuditStore.getState().selectedUserAgent).toBe('googlebot_desktop');
  });

  it('clears the selected audit without substituting a fabricated result', () => {
    useAuditStore.getState().setAuditData(mockAudit);
    expect(useAuditStore.getState().currentAudit?.url).toBe('https://example.com');

    useAuditStore.getState().clearAudit();
    expect(useAuditStore.getState().currentAudit).toBeNull();
  });

  it('imports a project-local, deduplicated CSV queue without fabricating invalid URLs', () => {
    localStorage.setItem('seomi_active_project_v1', 'project-csv');
    useAuditStore.getState().importAuditCsv('url\nhttps://example.com/a#fragment\nhttps://example.com/a\ninvalid-url');

    expect(useAuditStore.getState().batchItems).toMatchObject([
      { url: 'https://example.com/a', status: 'queued' },
    ]);
    expect(useAuditStore.getState().batchRejectedRows).toEqual(['invalid-url']);
    expect(JSON.parse(localStorage.getItem('seomi_project_project-csv_audit_queue_v1') || '[]')).toHaveLength(1);
  });

  it('persists the only-problems preference per project', () => {
    localStorage.setItem('seomi_active_project_v1', 'project-filter');
    useAuditStore.getState().setShowOnlyProblems(true);
    useAuditStore.getState().hydrateProject('project-filter');

    expect(useAuditStore.getState().showOnlyProblems).toBe(true);
    expect(localStorage.getItem('seomi_project_project-filter_audit_only_problems_v1')).toBe('true');
  });

  it('remembers the last workspace module independently for each project', () => {
    localStorage.setItem('seomi_active_project_v1', 'project-navigation-a');
    useAuditStore.getState().hydrateProject('project-navigation-a');
    useAuditStore.getState().setActiveTab('keyword-clustering');

    localStorage.setItem('seomi_active_project_v1', 'project-navigation-b');
    useAuditStore.getState().hydrateProject('project-navigation-b');
    expect(useAuditStore.getState().activeTab).toBe('overview');

    localStorage.setItem('seomi_active_project_v1', 'project-navigation-a');
    useAuditStore.getState().hydrateProject('project-navigation-a');
    expect(useAuditStore.getState().activeTab).toBe('keyword-clustering');
  });

  it('uses the original project history to detect score regressions', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-regression');
    localStorage.setItem('seomi_project_project-regression_audit_history', JSON.stringify([{ ...mockAudit, health_score: 98 }]));
    useAuditStore.getState().hydrateProject('project-regression');
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);

    await useAuditStore.getState().startAudit(mockAudit.url);

    expect(notifyAuditCompleted).toHaveBeenCalledWith('project-regression', mockAudit, 98);
    expect(JSON.parse(localStorage.getItem('seomi_project_project-regression_audit_history') || '[]')[0].health_score).toBe(95);
  });

  it('does not expose the raw storage quota error from a page audit', async () => {
    const projectId = 'project-audit-quota';
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(invokeTauriCommand).mockRejectedValueOnce(new Error('The quota has been exceeded.'));

    await useAuditStore.getState().startAudit(mockAudit.url);

    expect(useAuditStore.getState().error).toBe(i18n.t('runtimeErrors.persistence.localQuota'));
    expect(useAuditStore.getState().currentAudit).toBeNull();
  });

  it('recovers page-audit history when the first durable snapshot hits quota', async () => {
    const projectId = 'project-audit-history-recovery';
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);
    const originalSetItem = Storage.prototype.setItem;
    let historyWrites = 0;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(this: Storage, key: string, value: string) {
      if (key.includes('audit_history') && historyWrites++ === 0) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      originalSetItem.call(this, key, value);
    });

    await useAuditStore.getState().startAudit(mockAudit.url);

    expect(useAuditStore.getState().error).toBeNull();
    expect(useAuditStore.getState().currentAudit).toEqual(mockAudit);
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_audit_history`) || '[]')[0]).toMatchObject({ url: mockAudit.url });
    setItem.mockRestore();
  });

  it('does not trigger a paid DataForSEO request as a side effect of a page audit', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-explicit-data');
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'live-login', password: 'live-password' } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await useAuditStore.getState().startAudit(mockAudit.url);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persists live DataForSEO evidence per project and restores it only for the matching audit host', async () => {
    const projectId = 'project-live-evidence';
    localStorage.setItem('seomi_active_project_v1', projectId);
    localStorage.setItem(`seomi_project_${projectId}_audit_history`, JSON.stringify([mockAudit]));
    useAuditStore.getState().hydrateProject(projectId);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'live-login', password: 'live-password' } });
    const summary = { target: 'example.com', total_backlinks: 12, referring_domains: 4, referring_main_domains: 3, rank: 55, dofollow_backlinks: 8, broken_backlinks: 1 };
    const serp = [{ type: 'organic', rank_group: 1, rank_absolute: 1, domain: 'example.com', title: 'Result', description: 'Description', url: 'https://example.com/result' }];
    dataForSeoMocks.getBacklinksSummary.mockResolvedValue(summary);
    dataForSeoMocks.getSerpCompetitors.mockResolvedValue(serp);

    await useAuditStore.getState().fetchDataForSEO('example.com');
    await useAuditStore.getState().fetchDataForSEOSerp('technical seo', 2840);

    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_dataforseo_summary_v1`) || 'null')).toEqual(summary);
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_dataforseo_serp_v1`) || '[]')).toEqual(serp);

    useAuditStore.getState().hydrateProject(projectId);
    expect(useAuditStore.getState().dataforseoData).toEqual(summary);
    expect(useAuditStore.getState().dataforseoSerp).toEqual(serp);

    localStorage.setItem(`seomi_project_${projectId}_audit_history`, JSON.stringify([{ ...mockAudit, final_url: 'https://other.example/' }]));
    useAuditStore.getState().hydrateProject(projectId);
    expect(useAuditStore.getState().dataforseoData).toBeNull();
    expect(useAuditStore.getState().dataforseoSerp).toEqual([]);
  });

  it('does not let a late DataForSEO response mutate a newly selected project', async () => {
    const sourceProject = 'project-data-source';
    localStorage.setItem('seomi_active_project_v1', sourceProject);
    useAuditStore.getState().hydrateProject(sourceProject);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'live-login', password: 'live-password' } });
    let resolveSummary!: (value: DataForSEOBacklinkSummary) => void;
    dataForSeoMocks.getBacklinksSummary.mockReturnValue(new Promise((resolve) => { resolveSummary = resolve; }));

    const pending = useAuditStore.getState().fetchDataForSEO('example.com');
    localStorage.setItem('seomi_active_project_v1', 'project-data-next');
    useAuditStore.getState().hydrateProject('project-data-next');
    resolveSummary({ target: 'example.com', total_backlinks: 1, referring_domains: 1, referring_main_domains: 1, rank: 1, dofollow_backlinks: 1, broken_backlinks: 0 });
    await pending;

    expect(useAuditStore.getState().dataforseoData).toBeNull();
    expect(localStorage.getItem('seomi_project_project-data-next_dataforseo_summary_v1')).toBeNull();
    expect(JSON.parse(localStorage.getItem('seomi_project_project-data-source_dataforseo_summary_v1') || 'null')).toMatchObject({ target: 'example.com' });
  });

  it('keeps the newest DataForSEO summary when same-project requests finish out of order', async () => {
    const projectId = 'project-data-order';
    localStorage.setItem('seomi_active_project_v1', projectId);
    useAuditStore.getState().hydrateProject(projectId);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'live-login', password: 'live-password' } });
    let releaseOld!: (value: DataForSEOBacklinkSummary) => void;
    let calls = 0;
    dataForSeoMocks.getBacklinksSummary.mockImplementation((target: string) => {
      calls += 1;
      if (calls === 1) return new Promise<DataForSEOBacklinkSummary>((resolve) => { releaseOld = resolve; });
      return Promise.resolve({ target, total_backlinks: 99, referring_domains: 9, referring_main_domains: 9, rank: 90, dofollow_backlinks: 99, broken_backlinks: 0 });
    });

    const oldRequest = useAuditStore.getState().fetchDataForSEO('old.example');
    await Promise.resolve();
    const newRequest = useAuditStore.getState().fetchDataForSEO('new.example');
    await newRequest;
    expect(useAuditStore.getState().dataforseoData?.target).toBe('new.example');

    releaseOld({ target: 'old.example', total_backlinks: 1, referring_domains: 1, referring_main_domains: 1, rank: 1, dofollow_backlinks: 1, broken_backlinks: 0 });
    await oldRequest;
    expect(useAuditStore.getState().dataforseoData?.target).toBe('new.example');
    expect(JSON.parse(localStorage.getItem('seomi_project_' + projectId + '_dataforseo_summary_v1') || 'null')).toMatchObject({ target: 'new.example' });
  });

  it('saves a running audit to its source project without replacing the newly selected project', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-source');
    useAuditStore.getState().hydrateProject('project-source');
    let resolveAudit!: (data: PageAuditData) => void;
    vi.mocked(invokeTauriCommand).mockReturnValue(new Promise((resolve) => { resolveAudit = resolve; }));

    const runningAudit = useAuditStore.getState().startAudit(mockAudit.url);
    localStorage.setItem('seomi_active_project_v1', 'project-next');
    useAuditStore.getState().hydrateProject('project-next');
    resolveAudit(mockAudit);
    await runningAudit;

    expect(useAuditStore.getState().currentAudit).toBeNull();
    expect(JSON.parse(localStorage.getItem('seomi_project_project-source_audit_history') || '[]')[0].url).toBe(mockAudit.url);
    expect(JSON.parse(localStorage.getItem('seomi_project_project-next_audit_history') || '[]')).toEqual([]);
    expect(notifyAuditCompleted).toHaveBeenCalledWith('project-source', mockAudit, undefined);
  });

  it('keeps the newest page audit when same-project requests finish out of order', async () => {
    const projectId = 'project-audit-order';
    localStorage.setItem('seomi_active_project_v1', projectId);
    useAuditStore.getState().hydrateProject(projectId);
    let resolveOld!: (data: PageAuditData) => void;
    let calls = 0;
    const freshAudit = { ...mockAudit, url: 'https://new.example/', final_url: 'https://new.example/', timestamp: '2026-09-26T00:00:02.000Z' };
    const staleAudit = { ...mockAudit, url: 'https://old.example/', final_url: 'https://old.example/', timestamp: '2026-09-26T00:00:01.000Z' };
    vi.mocked(invokeTauriCommand).mockImplementation((command) => {
      if (command !== 'inspect_url') return Promise.resolve(undefined) as never;
      calls += 1;
      if (calls === 1) return new Promise<PageAuditData>((resolve) => { resolveOld = resolve; }) as never;
      return Promise.resolve(freshAudit) as never;
    });

    const oldRequest = useAuditStore.getState().startAudit(staleAudit.url);
    await Promise.resolve();
    const newRequest = useAuditStore.getState().startAudit(freshAudit.url);
    await newRequest;
    expect(useAuditStore.getState().currentAudit?.url).toBe(freshAudit.url);

    resolveOld(staleAudit);
    await oldRequest;
    expect(useAuditStore.getState().currentAudit?.url).toBe(freshAudit.url);
    expect(JSON.parse(localStorage.getItem('seomi_project_' + projectId + '_audit_history') || '[]')).toMatchObject([{ url: freshAudit.url }]);
  });

  it('runs the project-local CSV queue and reports one bounded batch summary', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-batch');
    localStorage.setItem('seomi_project_project-batch_audit_history', JSON.stringify([{ ...mockAudit, health_score: 98 }]));
    useAuditStore.getState().hydrateProject('project-batch');
    useAuditStore.getState().importAuditCsv('url\nhttps://example.com');
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);

    await useAuditStore.getState().startBatchAudits();

    expect(useAuditStore.getState().batchItems).toMatchObject([{ url: 'https://example.com/', status: 'completed' }]);
    expect(notifyAuditCompleted).not.toHaveBeenCalled();
    expect(notifyBatchCompleted).toHaveBeenCalledWith('project-batch', {
      completed: 1,
      failed: 0,
      queued: 0,
      regressionCount: 1,
      stopped: false,
    });
    expect(useAuditStore.getState().currentAudit).toEqual(mockAudit);
  });

  it('arms and disarms the native queue wake-up around a foreground run', async () => {
    const projectId = 'project-queue-wakeup';
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    useAuditStore.getState().hydrateProject(projectId);
    useAuditStore.getState().importAuditCsv('url\nhttps://example.com');
    vi.mocked(invokeTauriCommand).mockResolvedValue(mockAudit);

    await useAuditStore.getState().startBatchAudits();

    await vi.waitFor(() => expect(vi.mocked(invokeTauriCommand).mock.calls.some(([command]) => command === 'register_audit_queue_wakeup')).toBe(true));
    await vi.waitFor(() => expect(vi.mocked(invokeTauriCommand).mock.calls.some(([command]) => command === 'unregister_audit_queue_wakeup')).toBe(true));
  });

  it('keeps a batch result out of a newly selected project while the source queue finishes', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-batch-source');
    useAuditStore.getState().hydrateProject('project-batch-source');
    useAuditStore.getState().importAuditCsv('url\nhttps://example.com');
    vi.mocked(invokeTauriCommand).mockImplementation(async () => {
      localStorage.setItem('seomi_active_project_v1', 'project-batch-next');
      return mockAudit;
    });

    await useAuditStore.getState().startBatchAudits();

    expect(useAuditStore.getState().currentAudit).toBeNull();
    expect(JSON.parse(localStorage.getItem('seomi_project_project-batch-source_audit_history') || '[]')[0].url).toBe(mockAudit.url);
    expect(JSON.parse(localStorage.getItem('seomi_project_project-batch-source_audit_queue_v1') || '[]')).toMatchObject([{ status: 'completed' }]);
    expect(JSON.parse(localStorage.getItem('seomi_project_project-batch-next_audit_queue_v1') || '[]')).toEqual([]);
    expect(notifyAuditCompleted).not.toHaveBeenCalled();
    expect(notifyBatchCompleted).toHaveBeenCalledWith('project-batch-source', {
      completed: 1,
      failed: 0,
      queued: 0,
      regressionCount: 0,
      stopped: false,
    });
  });

  it('keeps a newer project batch running while an older project batch finishes', async () => {
    const sourceProject = 'project-batch-overlap-source';
    const nextProject = 'project-batch-overlap-next';
    localStorage.setItem('seomi_active_project_v1', sourceProject);
    useAuditStore.getState().hydrateProject(sourceProject);
    useAuditStore.getState().importAuditCsv('url\nhttps://source.example');

    const resolvers: Array<(value: PageAuditData) => void> = [];
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'inspect_url') {
        return new Promise<PageAuditData>((resolve) => { resolvers.push(resolve); }) as never;
      }
      return undefined as never;
    });

    const sourceRun = useAuditStore.getState().startBatchAudits();
    await vi.waitFor(() => expect(useAuditStore.getState().activeBatchRequestId).toBeTruthy());

    localStorage.setItem('seomi_active_project_v1', nextProject);
    useAuditStore.getState().hydrateProject(nextProject);
    useAuditStore.getState().importAuditCsv('url\nhttps://next.example');
    const nextRun = useAuditStore.getState().startBatchAudits();
    await vi.waitFor(() => expect(useAuditStore.getState().activeBatchRequestId).toBeTruthy());
    const nextRequestId = useAuditStore.getState().activeBatchRequestId;

    resolvers[0]?.({ ...mockAudit, url: 'https://source.example/', final_url: 'https://source.example/' });
    await sourceRun;

    expect(useAuditStore.getState()).toMatchObject({
      isBatchRunning: true,
      activeBatchRequestId: nextRequestId,
    });

    resolvers[1]?.({ ...mockAudit, url: 'https://next.example/', final_url: 'https://next.example/' });
    await nextRun;
    expect(useAuditStore.getState().isBatchRunning).toBe(false);
    expect(useAuditStore.getState().batchItems).toMatchObject([{ url: 'https://next.example/', status: 'completed' }]);
  });

  it('cancels the in-flight audit and leaves that URL queued for resume', async () => {
    localStorage.setItem('seomi_active_project_v1', 'project-cancel');
    useAuditStore.getState().hydrateProject('project-cancel');
    useAuditStore.getState().importAuditCsv('url\nhttps://example.com');
    let rejectAudit!: (error: Error) => void;
    vi.mocked(invokeTauriCommand).mockImplementation((command) => {
      if (command === 'inspect_url') {
        return new Promise((_, reject) => { rejectAudit = reject; });
      }
      return Promise.resolve(true);
    });

    const running = useAuditStore.getState().startBatchAudits();
    await vi.waitFor(() => expect(useAuditStore.getState().activeBatchRequestId).toBeTruthy());
    useAuditStore.getState().stopBatchAudits();
    rejectAudit(new Error('Audit cancelled by user.'));
    await running;

    expect(useAuditStore.getState().batchItems).toMatchObject([
      { url: 'https://example.com/', status: 'queued' },
    ]);
    expect(useAuditStore.getState().batchRun?.status).toBe('stopped');
    expect(vi.mocked(invokeTauriCommand).mock.calls.some(([command]) => command === 'cancel_inspect_url')).toBe(true);
  });

  it('recovers a running queue as interrupted after a restart', () => {
    const projectId = 'project-restart';
    localStorage.setItem('seomi_active_project_v1', projectId);
    localStorage.setItem(`seomi_project_${projectId}_audit_queue_v1`, JSON.stringify([
      { id: 'active', url: 'https://example.com/active', status: 'running' },
      { id: 'done', url: 'https://example.com/done', status: 'completed', completedAt: '2026-09-24T10:00:00.000Z' },
    ]));
    localStorage.setItem(`seomi_project_${projectId}_audit_queue_run_v1`, JSON.stringify({
      id: 'run-1', status: 'running', startedAt: '2026-09-24T09:00:00.000Z', updatedAt: '2026-09-24T09:30:00.000Z', activeItemId: 'active',
    }));

    useAuditStore.getState().hydrateProject(projectId);

    expect(useAuditStore.getState().batchItems).toMatchObject([
      { id: 'active', status: 'interrupted', error: i18n.t('runtimeErrors.audit.batchInterrupted') },
      { id: 'done', status: 'completed' },
    ]);
    expect(useAuditStore.getState().batchRun).toMatchObject({ id: 'run-1', status: 'interrupted', activeItemId: 'active' });
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_audit_queue_v1`) || '[]')[0].status).toBe('interrupted');
  });

  it('hydrates a native queue snapshot and marks an in-flight item resumable', async () => {
    const projectId = 'project-native-audit-queue';
    const snapshot = {
      items: [{ id: 'active', url: 'https://example.com/active', status: 'running', updatedAt: '2026-09-25T10:00:00.000Z' }],
      run: { id: 'run-native', status: 'running', startedAt: '2026-09-25T09:00:00.000Z', updatedAt: '2026-09-25T10:00:00.000Z', activeItemId: 'active' },
    };
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'load_project_audit_queue') return snapshot as never;
      return undefined as never;
    });

    useAuditStore.getState().hydrateProject(projectId);

    await vi.waitFor(() => expect(useAuditStore.getState().batchItems).toMatchObject([
      { id: 'active', status: 'interrupted', error: i18n.t('runtimeErrors.audit.batchInterrupted') },
    ]));
    expect(useAuditStore.getState().batchRun).toMatchObject({ id: 'run-native', status: 'interrupted' });
    expect(vi.mocked(invokeTauriCommand).mock.calls.some(([command]) => command === 'save_project_audit_queue')).toBe(true);
  });

  it('writes imported batch URLs to the native project snapshot', async () => {
    const projectId = 'project-native-audit-import';
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'load_project_audit_queue') return null as never;
      return undefined as never;
    });

    useAuditStore.getState().hydrateProject(projectId);
    useAuditStore.getState().importAuditCsv('url\nhttps://example.com/native');

    await vi.waitFor(() => expect(vi.mocked(invokeTauriCommand).mock.calls.some(([command, args]) => (
      command === 'save_project_audit_queue'
      && JSON.stringify(args).includes('https://example.com/native')
    ))).toBe(true));
  });

  it('imports headless queue results and acknowledges only durable handoffs', async () => {
    const projectId = 'project-native-audit-results';
    localStorage.setItem('seomi_active_project_v1', projectId);
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    const headlessAudit = { ...mockAudit, url: 'https://example.com/headless', final_url: 'https://example.com/headless' };
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => {
      if (command === 'load_project_audit_queue') {
        return {
          items: [{ id: 'item-headless', url: headlessAudit.url, status: 'completed' }],
          run: { id: 'run-headless', status: 'completed', startedAt: headlessAudit.timestamp, updatedAt: headlessAudit.timestamp },
        } as never;
      }
      if (command === 'list_project_audit_queue_results') {
        return [{ runId: 'run-headless', itemId: 'item-headless', audit: headlessAudit }] as never;
      }
      if (command === 'list_project_audit_queue_executions') {
        return [{ runId: 'run-headless' }] as never;
      }
      return undefined as never;
    });

    useAuditStore.getState().hydrateProject(projectId);

    await vi.waitFor(() => expect(useAuditStore.getState().currentAudit?.url).toBe(headlessAudit.url));
    expect(JSON.parse(localStorage.getItem(`seomi_project_${projectId}_audit_history`) || '[]')[0].url).toBe(headlessAudit.url);
    expect(vi.mocked(invokeTauriCommand).mock.calls).toContainEqual([
      'acknowledge_project_audit_queue_result',
      { projectId, runId: 'run-headless', itemId: 'item-headless' },
    ]);
    expect(vi.mocked(invokeTauriCommand).mock.calls).toContainEqual([
      'acknowledge_project_audit_queue_execution',
      { projectId, runId: 'run-headless' },
    ]);
  });

  it('resumes only unfinished queue items and keeps the original run identity', async () => {
    const projectId = 'project-resume';
    localStorage.setItem('seomi_active_project_v1', projectId);
    localStorage.setItem(`seomi_project_${projectId}_audit_queue_v1`, JSON.stringify([
      { id: 'done', url: 'https://example.com/done', status: 'completed' },
      { id: 'pending', url: 'https://example.com/pending', status: 'interrupted' },
    ]));
    localStorage.setItem(`seomi_project_${projectId}_audit_queue_run_v1`, JSON.stringify({
      id: 'run-resume', status: 'interrupted', startedAt: '2026-09-24T09:00:00.000Z', updatedAt: '2026-09-24T09:30:00.000Z',
    }));
    useAuditStore.getState().hydrateProject(projectId);
    vi.mocked(invokeTauriCommand).mockResolvedValue({ ...mockAudit, url: 'https://example.com/pending', final_url: 'https://example.com/pending' });

    await useAuditStore.getState().startBatchAudits();

    expect(vi.mocked(invokeTauriCommand).mock.calls.filter(([command]) => command === 'inspect_url')).toHaveLength(1);
    expect(vi.mocked(invokeTauriCommand).mock.calls[0][1]).toMatchObject({ url: 'https://example.com/pending' });
    expect(useAuditStore.getState().batchRun).toMatchObject({ id: 'run-resume', status: 'completed' });
    expect(useAuditStore.getState().batchItems).toMatchObject([
      { id: 'done', status: 'completed' },
      { id: 'pending', status: 'completed' },
    ]);
  });
});
