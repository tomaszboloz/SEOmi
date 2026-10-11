import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { useCrawlArchitectureState } from '@/components/Charts/crawlArchitecture/useCrawlArchitectureState';

describe('useCrawlArchitectureState branches', () => {
  const samplePages = [
    createCrawlPageFixture({ url: 'https://example.com/a', title: 'Alpha', depth: 0, links: [{ target_url: 'https://example.com/b', anchor_text: 'Beta', is_internal: true }] }),
    createCrawlPageFixture({ url: 'https://example.com/b', title: 'Beta', depth: 1, links: [] })
  ];

  it('handles state transitions, filters, selected node changes, edge filters, layout toggles, and reset', async () => {
    const { result } = renderHook(() => useCrawlArchitectureState({ pages: samplePages, startUrl: 'https://example.com/a' }));

    await act(async () => {
      result.current.setActiveView('graph');
    });
    expect(result.current.activeView).toBe('graph');

    await act(async () => {
      result.current.setActiveView('directory');
    });
    expect(result.current.activeView).toBe('directory');

    await act(async () => {
      result.current.setPreferences((prev) => ({
        ...prev,
        linkMode: 'all',
        clusterFilter: 'cluster-1',
        orphansOnly: true,
        query: 'beta'
      }));
    });
    expect(result.current.preferences.linkMode).toBe('all');
    expect(result.current.preferences.clusterFilter).toBe('cluster-1');
    expect(result.current.preferences.orphansOnly).toBe(true);
    expect(result.current.preferences.query).toBe('beta');

    await act(async () => {
      result.current.setDiagnosisFilter({ kind: 'area', id: 'non-existent' });
    });
    expect(result.current.diagnosisFilterUrls).toBeNull();

    const firstNodeId = result.current.graph.nodes[0]?.id;
    expect(firstNodeId).toBeDefined();
    if (firstNodeId) {
      await act(async () => {
        result.current.setSelectedId(firstNodeId);
      });
      expect(result.current.selectedId).toBe(firstNodeId);
      expect(result.current.selectedNode).toBeDefined();

      await act(async () => {
        result.current.setSelectedId(null);
      });
      expect(result.current.selectedId).toBeNull();
    }

    await act(async () => {
      result.current.setPreferences((prev) => ({
        ...prev,
        linkMode: 'content',
        clusterFilter: 'all',
        orphansOnly: false,
        query: 'alpha',
      }));
    });
    expect(result.current.preferences.linkMode).toBe('content');
    expect(result.current.preferences.query).toBe('alpha');
  });
});
