import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';

import { useToolsStore } from '../src/stores/toolsStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';
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

it('persists the rank tracking draft per project, including the full market and language selection', async () => {
    const firstProject = 'project-rank-draft-one';
    const secondProject = 'project-rank-draft-two';
    useProjectStore.setState({
      projects: [
        { id: firstProject, name: 'Rank one', rootUrl: 'https://one.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
        { id: secondProject, name: 'Rank two', rootUrl: 'https://two.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
      ],
      activeProjectId: firstProject,
    });
    localStorage.setItem('seomi_active_project_v1', firstProject);

    await useToolsStore.getState().hydrateProject(firstProject);
    useToolsStore.getState().setRankTrackingDraft({
      keyword: 'technical seo',
      domain: 'example.com',
      targetUrl: 'https://example.com/seo',
      location: 'PL',
      language: 'pl',
    });
    expect(JSON.parse(localStorage.getItem(`seomi_project_${firstProject}_rank_tracking_draft_v1`) || '{}')).toMatchObject({
      keyword: 'technical seo', domain: 'example.com', targetUrl: 'https://example.com/seo', location: 'PL', language: 'pl',
    });

    localStorage.setItem('seomi_active_project_v1', secondProject);
    useProjectStore.setState({ activeProjectId: secondProject });
    await useToolsStore.getState().hydrateProject(secondProject);
    expect(useToolsStore.getState().rankTrackingDraft).toEqual({ keyword: '', domain: '', targetUrl: '', location: 'US', language: 'en' });

    localStorage.setItem('seomi_active_project_v1', firstProject);
    useProjectStore.setState({ activeProjectId: firstProject });
    await useToolsStore.getState().hydrateProject(firstProject);
    expect(useToolsStore.getState().rankTrackingDraft).toEqual({
      keyword: 'technical seo', domain: 'example.com', targetUrl: 'https://example.com/seo', location: 'PL', language: 'pl',
    });
  });

it('does not apply a request profile result after switching projects', async () => {
    const firstProject = 'project-profile-source';
    const secondProject = 'project-profile-target';
    localStorage.setItem('seomi_active_project_v1', firstProject);
    useToolsStore.setState({ crawlRequestProfiles: [], isSavingCrawlRequestProfile: false });
    let resolveSave!: (value: unknown) => void;
    vi.mocked(invokeTauriCommand).mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }) as never);

    const pending = useToolsStore.getState().saveCrawlRequestProfile({
      name: 'Authenticated crawl', userAgent: 'SeomiBot/1.0', headers: [], cookie: '', proxyUrl: '',
    });
    await Promise.resolve();
    localStorage.setItem('seomi_active_project_v1', secondProject);
    useToolsStore.setState({ crawlRequestProfiles: [], isSavingCrawlRequestProfile: true });
    resolveSave(undefined);
    await pending;

    expect(useToolsStore.getState().crawlRequestProfiles).toEqual([]);
    expect(useToolsStore.getState().isSavingCrawlRequestProfile).toBe(true);
    expect(invokeTauriCommand).toHaveBeenCalledWith('save_crawl_auth_profile', expect.objectContaining({ projectId: firstProject }));
    expect(localStorage.getItem(`seomi_project_${secondProject}_crawl_request_profiles_v1`)).toBeNull();
  });

it('does not remove a request profile from the newly selected project', async () => {
    const firstProject = 'project-profile-delete-source';
    const secondProject = 'project-profile-delete-target';
    localStorage.setItem('seomi_active_project_v1', firstProject);
    useToolsStore.setState({ crawlRequestProfiles: [{ id: 'profile-1', name: 'Source', userAgent: '', hasProxy: false, hasHeaders: false, hasCookie: false, createdAt: '2026-09-24T00:00:00.000Z', updatedAt: '2026-09-24T00:00:00.000Z' }] as never });
    let resolveDelete!: (value: unknown) => void;
    vi.mocked(invokeTauriCommand).mockReturnValue(new Promise((resolve) => { resolveDelete = resolve; }) as never);

    const pending = useToolsStore.getState().deleteCrawlRequestProfile('profile-1');
    await Promise.resolve();
    localStorage.setItem('seomi_active_project_v1', secondProject);
    useToolsStore.setState({ crawlRequestProfiles: [{ id: 'profile-1', name: 'Target', userAgent: '', hasProxy: false, hasHeaders: false, hasCookie: false, createdAt: '2026-09-24T00:00:00.000Z', updatedAt: '2026-09-24T00:00:00.000Z' }] as never });
    resolveDelete(undefined);
    await pending;

    expect(useToolsStore.getState().crawlRequestProfiles[0]?.name).toBe('Target');
    expect(invokeTauriCommand).toHaveBeenCalledWith('delete_crawl_auth_profile', { projectId: firstProject, profileId: 'profile-1' });
    expect(localStorage.getItem(`seomi_project_${secondProject}_crawl_request_profiles_v1`)).toBeNull();
  });

it('derives all new-request defaults from a Polish project and shares an explicitly selected market', async () => {
    const previous = useProjectStore.getState();
    localStorage.setItem('seomi_active_project_v1', 'market-project');
    useProjectStore.setState({ activeProjectId: 'market-project', projects: [{ id: 'market-project', name: 'Polish site', rootUrl: 'https://example.pl', createdAt: '2026-10-01', lastOpenedAt: '2026-10-01' }] });
    await useToolsStore.getState().hydrateProject('market-project');
    expect(useToolsStore.getState()).toMatchObject({ keywordCountry: 'PL', domainCountry: 'PL', rankTrackingDraft: { location: 'PL', language: 'pl' } });
    useToolsStore.getState().setDomainCountry('DE');
    expect(useToolsStore.getState()).toMatchObject({ keywordCountry: 'DE', domainCountry: 'DE', rankTrackingDraft: { location: 'DE' } });
    expect(localStorage.getItem('seomi_project_market-project_dataforseo_market_v1')).toBe('DE');
    await useToolsStore.getState().hydrateProject('market-project');
    expect(useToolsStore.getState().keywordCountry).toBe('DE');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await useToolsStore.getState().analyzeDomain('example.pl', 'invalid-country');
    expect(useToolsStore.getState().domainError).toBe(i18n.t('runtimeErrors.dataforseo.marketRequired'));
    expect(fetchMock).not.toHaveBeenCalled();
    useProjectStore.setState(previous);
  });

it('records a successful absent rank as outside the top 100 instead of not checked', async () => {
    localStorage.setItem('seomi_active_project_v1', 'rank-project');
    useToolsStore.setState({ trackedRanks: [] });
    useToolsStore.getState().addTrackedRank('seo audit', 'example.pl', 'https://example.pl', 'PL', 'pl');
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'login', password: 'password' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items: [] }] }] }))));
    await useToolsStore.getState().refreshAllRanks();
    expect(useToolsStore.getState().trackedRanks[0]).toMatchObject({ current_rank: 101, last_checked: expect.any(String), best_rank: null });
    useToolsStore.setState({ trackedRanks: [] });
  });
});
