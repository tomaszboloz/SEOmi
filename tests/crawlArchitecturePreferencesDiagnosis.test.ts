import { afterEach, describe, expect, it } from 'vitest';
import { emptyPreferences, readPreferences } from '@/components/Charts/crawlArchitecture/CrawlArchitectureHelpers';
import { buildMapViewTabs } from '@/components/Charts/crawlArchitecture/CrawlArchitectureTypes';

const KEY = 'seomi_project_p_semantic_map_run_v1';

describe('diagnosis preferences', () => {
  afterEach(() => localStorage.clear());

  it('opens the diagnosis view by default without a graph restriction', () => {
    expect(emptyPreferences()).toMatchObject({ activeView: 'diagnosis', diagnosisFilter: null });
    expect(buildMapViewTabs((key) => key).map((tab) => tab.id)).toEqual(['diagnosis', 'graph', 'directory', 'plan']);
  });

  it('round-trips a saved diagnosis filter and keeps a saved graph view', () => {
    localStorage.setItem(KEY, JSON.stringify({ activeView: 'graph', diagnosisFilter: { kind: 'topic', id: 'topic-3' } }));
    expect(readPreferences(KEY)).toMatchObject({ activeView: 'graph', diagnosisFilter: { kind: 'topic', id: 'topic-3' } });
  });

  it('opens the diagnosis once for preferences saved before the view existed', () => {
    localStorage.setItem(KEY, JSON.stringify({ activeView: 'plan' }));
    expect(readPreferences(KEY).activeView).toBe('diagnosis');
    localStorage.setItem(KEY, JSON.stringify({ activeView: 'plan', diagnosisFilter: null }));
    expect(readPreferences(KEY).activeView).toBe('plan');
  });

  it('drops a cluster filter saved before the topic list replaced the cluster list', () => {
    // The graph no longer offers the cluster list, so a restored cluster filter could never be lifted.
    localStorage.setItem(KEY, JSON.stringify({ activeView: 'graph', clusterFilter: 'cluster-3', orphansOnly: true }));
    expect(readPreferences(KEY)).toMatchObject({ clusterFilter: 'all', orphansOnly: true });
    localStorage.setItem(KEY, JSON.stringify({ activeView: 'graph', clusterFilter: 'cluster-3', diagnosisFilter: null }));
    expect(readPreferences(KEY).clusterFilter).toBe('cluster-3');
  });

  it('drops an invalid filter and an unknown view', () => {
    localStorage.setItem(KEY, JSON.stringify({ activeView: 'nonsense', diagnosisFilter: { kind: 'cluster', id: '' } }));
    expect(readPreferences(KEY)).toMatchObject({ activeView: 'diagnosis', diagnosisFilter: null });
  });
});
