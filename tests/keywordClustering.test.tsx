import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeywordClustering } from '../src/components/Keywords/KeywordClustering';
import { useProjectStore } from '../src/stores/projectStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useToolsStore } from '../src/stores/toolsStore';
import i18n from '../src/i18n';
import type { DataForSEOSerpItem } from '../src/types';

const { getSerpCompetitorsMock } = vi.hoisted(() => ({ getSerpCompetitorsMock: vi.fn() }));
vi.mock('../src/services/dataforseo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/dataforseo')>();
  // The component instantiates the client with `new`; keep the mock
  // constructible under Vitest 5 as well as older runners.
  return {
    ...actual,
    DataForSEOClient: vi.fn().mockImplementation(function DataForSEOClientMock() {
      return { getSerpCompetitors: getSerpCompetitorsMock };
    }),
  };
});

describe('KeywordClustering task', () => {
  beforeEach(() => {
    localStorage.clear();
    i18n.changeLanguage('en');
    localStorage.setItem('seomi_active_project_v1', 'project-clusters');
    // These tests cover the paid SERP-overlap method; embeddings are the default.
    localStorage.setItem('seomi_project_project-clusters_keyword_clustering_method_v1', 'serp');
    useProjectStore.setState({ activeProjectId: 'project-clusters' });
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
    useToolsStore.setState({ keywordResults: [], savedKeywords: [] });
    getSerpCompetitorsMock.mockReset().mockResolvedValue([
      { type: 'organic', url: 'https://one.example/page', rank_group: 1, rank_absolute: 1 },
      { type: 'organic', url: 'https://two.example/page', rank_group: 2, rank_absolute: 2 },
      { type: 'organic', url: 'https://three.example/page', rank_group: 3, rank_absolute: 3 },
    ] satisfies DataForSEOSerpItem[]);
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('pl');
    vi.unstubAllGlobals();
  });

  it('persists clustering inputs in the active project and does not call the API without credentials', () => {
    render(<KeywordClustering />);
    fireEvent.change(screen.getByLabelText('Keywords — one per line'), { target: { value: 'audyt seo\naudyt strony' } });

    expect(localStorage.getItem('seomi_keyword_clustering_project-clusters')).toContain('audyt seo');
    fireEvent.click(screen.getByRole('button', { name: 'Fetch SERPs and create clusters' }));
    expect(screen.getByText(/Connect DataForSEO/)).toBeTruthy();
    expect(getSerpCompetitorsMock).not.toHaveBeenCalled();
  });

  it('uses SERP rows and persists overlap evidence', async () => {
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'live-login', password: 'live-password' } });

    render(<KeywordClustering />);
    fireEvent.change(screen.getByLabelText('Keywords — one per line'), { target: { value: 'audyt seo\naudyt strony' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch SERPs and create clusters' }));

    expect(await screen.findByText('Clustering result')).toBeTruthy();
    await waitFor(() => expect(getSerpCompetitorsMock).toHaveBeenCalledTimes(2));
    const saved = JSON.parse(localStorage.getItem('seomi_keyword_clustering_project-clusters') || '{}');
    expect(saved.result).toMatchObject({
      minSharedUrls: 3,
      snapshots: [
        { keyword: 'audyt seo', urls: ['one.example/page', 'two.example/page', 'three.example/page'] },
        { keyword: 'audyt strony', urls: ['one.example/page', 'two.example/page', 'three.example/page'] },
      ],
      clusters: expect.any(Array),
    });
    expect(saved.result.clusters).toHaveLength(1);
    expect(saved.result.clusters[0]).toMatchObject({ keywords: ['audyt seo', 'audyt strony'] });
    expect(saved.result.clusters[0].pairOverlaps[0].sharedUrls).toEqual(['one.example/page', 'two.example/page', 'three.example/page']);
  });

  it('preserves successful snapshots and retries only the failed keyword', async () => {
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'live-login', password: 'live-password' } });
    const rows = [{ type: 'organic', url: 'https://one.example/page', rank_group: 1, rank_absolute: 1 }];
    getSerpCompetitorsMock.mockResolvedValueOnce(rows).mockRejectedValueOnce(new Error('Temporary provider failure')).mockResolvedValueOnce(rows);
    render(<KeywordClustering />);
    fireEvent.change(screen.getByLabelText('Keywords — one per line'), { target: { value: 'audyt seo\naudyt strony' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch SERPs and create clusters' }));
    expect(await screen.findByText(/Temporary provider failure/)).toBeTruthy();
    const partial = JSON.parse(localStorage.getItem('seomi_keyword_clustering_project-clusters') || '{}');
    expect(partial.result.snapshots).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Fetch SERPs and create clusters' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('seomi_keyword_clustering_project-clusters') || '{}').result.snapshots).toHaveLength(2));
    expect(getSerpCompetitorsMock.mock.calls.map(([keyword]) => keyword)).toEqual(['audyt seo', 'audyt strony', 'audyt strony']);
    expect(JSON.parse(localStorage.getItem('seomi_keyword_clustering_project-clusters') || '{}').result.snapshots[0].urls).toEqual(['one.example/page']);
  });

  it('keeps keywords and rejects a stale market without silently making a US request', async () => {
    localStorage.setItem('seomi_keyword_clustering_project-clusters', JSON.stringify({
      input: 'audyt seo\naudyt strony', country: 'not-a-dataforseo-market', language: 'xx', minSharedUrls: 3,
    }));
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'live-login', password: 'live-password' } });

    render(<KeywordClustering />);
    expect((screen.getByRole('combobox', { name: 'SERP location' }) as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('combobox', { name: 'SERP language' }) as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Fetch SERPs and create clusters' }));

    expect(screen.getByText(i18n.t('runtimeErrors.dataforseo.marketRequired'))).toBeTruthy();
    expect((screen.getByLabelText('Keywords — one per line') as HTMLTextAreaElement).value).toBe('audyt seo\naudyt strony');
    expect(getSerpCompetitorsMock).not.toHaveBeenCalled();
  });

  it('stops launching paid SERP requests after switching projects mid-run', async () => {
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'live-login', password: 'live-password' } });
    let resolveFirstRequest!: (rows: DataForSEOSerpItem[]) => void;
    getSerpCompetitorsMock.mockImplementationOnce(() => new Promise((resolve) => { resolveFirstRequest = resolve; }));

    render(<KeywordClustering />);
    fireEvent.change(screen.getByLabelText('Keywords — one per line'), { target: { value: 'audyt seo\naudyt strony\npozycjonowanie' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch SERPs and create clusters' }));
    await waitFor(() => expect(getSerpCompetitorsMock).toHaveBeenCalledTimes(1));

    act(() => useProjectStore.setState({ activeProjectId: 'different-project' }));
    await act(async () => { resolveFirstRequest([]); await Promise.resolve(); });
    await waitFor(() => expect((screen.getByLabelText('Keywords — one per line') as HTMLTextAreaElement).value).toBe(''));
    expect(getSerpCompetitorsMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('seomi_keyword_clustering_different-project')).toBeNull();
  });
});
