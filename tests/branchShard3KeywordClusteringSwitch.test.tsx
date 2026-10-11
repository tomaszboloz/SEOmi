import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useKeywordClusteringSession } from '@/components/Keywords/keywordClustering/useKeywordClusteringSession';
import { sessionKey } from '@/components/Keywords/keywordClustering/keywordClusteringTypes';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({ serp: vi.fn(), calls: 0 }));
vi.mock('@/services/dataforseo', async (orig) => ({
  ...(await orig<typeof import('@/services/dataforseo')>()),
  DataForSEOClient: vi.fn().mockImplementation(function Client() { return { getSerpCompetitors: mocks.serp }; }),
}));
vi.mock('@/services/keywordClustering', async (orig) => {
  const real = await orig<typeof import('@/services/keywordClustering')>();
  return {
    ...real,
    clusterKeywordsBySerpOverlap: (...args: Parameters<typeof real.clusterKeywordsBySerpOverlap>) => {
      mocks.calls += 1;
      // Calls 1 and 2 are the per-keyword partial results, call 3 is the final one.
      if (mocks.calls === 3) useProjectStore.setState({ activeProjectId: 'p2' });
      return real.clusterKeywordsBySerpOverlap(...args);
    },
  };
});

beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
  mocks.calls = 0;
  mocks.serp.mockReset().mockImplementation(async () => [1, 2, 3].map((i) => ({ url: `https://shared.example/${i}` })));
  useProjectStore.setState({ activeProjectId: 'p1' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'l', password: 'p' } });
});

it('does not publish the final clustering when the project changed after the last keyword', async () => {
  const { result } = renderHook(() => useKeywordClusteringSession(i18n.t.bind(i18n)));
  act(() => result.current.updateSession({ input: 'a\nb' }));
  await act(async () => result.current.runClustering());
  expect(mocks.serp).toHaveBeenCalledTimes(2);
  expect(mocks.calls).toBe(3);
  // Only the partial result of the second keyword was persisted for p1; the final write was skipped.
  expect(JSON.parse(localStorage.getItem(sessionKey('p1'))!).result.snapshots).toHaveLength(2);
  expect(localStorage.getItem(sessionKey('p2'))).toBeNull();
  expect(result.current.error).toBeNull();
});
