import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCrawlArchitectureState } from '@/components/Charts/crawlArchitecture/useCrawlArchitectureState';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { createCrawlPageFixture } from './fixtures/crawl';

const pages = [
  createCrawlPageFixture({
    url: 'https://site.test/coffee', final_url: 'https://site.test/coffee', title: 'Coffee',
    semantic_terms: ['coffee', 'brewing'],
    semantic_links: [{ target_url: 'https://site.test/grind', anchor_text: 'grind', is_internal: true }],
  }),
  createCrawlPageFixture({
    url: 'https://site.test/grind', final_url: 'https://site.test/grind', title: 'Grinding',
    semantic_terms: ['coffee', 'brewing', 'grinding'], semantic_links: [],
  }),
  createCrawlPageFixture({
    url: 'https://site.test/orphan', final_url: 'https://site.test/orphan',
    semantic_links: [],
  }),
];

const props = { pages, startUrl: pages[0].url, runId: 'fallback-run' };
const projectId = 'architecture-direct';
let projectSnapshot: ReturnType<typeof useProjectStore.getState>;
let toolsSnapshot: ReturnType<typeof useToolsStore.getState>;

beforeEach(() => {
  projectSnapshot = useProjectStore.getState();
  toolsSnapshot = useToolsStore.getState();
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: projectId });
  useToolsStore.setState({ selectedCrawlRunId: 'selected-run' });
});

afterEach(() => {
  useProjectStore.setState(projectSnapshot, true);
  useToolsStore.setState(toolsSnapshot, true);
  localStorage.clear();
});

describe('useCrawlArchitectureState direct contracts', () => {
  it('resolves run ids, selects known/unknown nodes and persists view changes', () => {
    const { result } = renderHook(() => useCrawlArchitectureState(props));
    const key = `seomi_project_${projectId}_semantic_map_selected-run_v1`;
    expect(result.current.effectiveRunId).toBe('selected-run');
    expect(result.current.selectedId).toBeNull();

    act(() => result.current.setSelectedId(result.current.graph.nodes[0].id));
    expect(result.current.selectedNode?.page.url).toBe(pages[0].url);
    act(() => result.current.setSelectedId('missing-node'));
    expect(result.current.selectedId).toBeNull();
    act(() => result.current.setSelectedId(null));
    expect(result.current.selectedOutboundEdges).toEqual([]);

    act(() => result.current.setActiveView('directory'));
    expect(result.current.activeView).toBe('directory');
    expect(JSON.parse(localStorage.getItem(key) || '{}')).toMatchObject({ activeView: 'directory' });
  });

  it('filters by cluster, orphan state and normalized query while exposing selected edges', () => {
    const { result } = renderHook(() => useCrawlArchitectureState(props));
    const firstId = result.current.graph.nodes[0].id;
    act(() => result.current.setSelectedId(firstId));
    expect(result.current.selectedOutboundEdges).toHaveLength(1);
    expect(result.current.selectedTopicEdges.length).toBeGreaterThan(0);
    act(() => result.current.setSelectedId(result.current.graph.nodes[1].id));
    expect(result.current.selectedTopicEdges.length).toBeGreaterThan(0);

    act(() => result.current.setPreferences((previous) => ({ ...previous, clusterFilter: 'missing' })));
    expect(result.current.visibleNodes).toEqual([]);
    act(() => result.current.setPreferences((previous) => ({ ...previous, clusterFilter: 'all', orphansOnly: true, query: '' })));
    expect(result.current.visibleNodes.map((node) => node.page.url)).toEqual([pages[2].url]);
    act(() => result.current.setPreferences((previous) => ({ ...previous, orphansOnly: false, query: 'ORPHAN' })));
    expect(result.current.visibleNodes.map((node) => node.page.url)).toEqual([pages[2].url]);

    act(() => result.current.setSelectedId(null));
    expect(result.current.selectedTopicEdges).toEqual([]);
  });
});
