import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendDataForSeoTask, clearDataForSeoTaskLog, readDataForSeoTaskLog } from '@/services/dataforseo';
import { loadCrawlRequestProfiles, persistCrawlRequestProfiles } from '@/stores/tools/crawlPersistence';
import { useProjectStore } from '@/stores/projectStore';
import type { CrawlRequestProfile } from '@/types';

const initialProject = useProjectStore.getState().activeProjectId;
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: null });
});
afterEach(() => {
  vi.restoreAllMocks();
  useProjectStore.setState({ activeProjectId: initialProject });
});

describe('remaining public project persistence contracts', () => {
  it('clears only the requested task log and does nothing without a project identity', () => {
    const task = { endpoint: 'fixture/endpoint', taskId: 'task-1', statusCode: 20000, statusMessage: 'fixture success',
      cost: null, timeSeconds: null, resultCount: 0, requestedAt: '2026-10-01T00:00:00Z', completedAt: '2026-10-01T00:00:01Z' };
    appendDataForSeoTask(task, 'project-a');
    appendDataForSeoTask(task, 'project-b');
    clearDataForSeoTaskLog(null);
    expect(readDataForSeoTaskLog('project-a')).toHaveLength(1);
    clearDataForSeoTaskLog('project-a');
    expect(readDataForSeoTaskLog('project-a')).toEqual([]);
    expect(readDataForSeoTaskLog('project-b')).toHaveLength(1);
  });

  it('keeps integration helpers usable if the storage implementation refuses deletion', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage locked'); });
    expect(() => clearDataForSeoTaskLog('project-a')).not.toThrow();
  });

  it('persists request profile metadata against the current project after a switch', () => {
    const profile: CrawlRequestProfile = { id: 'profile-1', name: 'Profile A', userAgent: 'SEOmi test',
      hasProxy: false, hasHeaders: true, hasCookie: false, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
    persistCrawlRequestProfiles([profile]);
    expect(localStorage.length).toBe(0);
    useProjectStore.setState({ activeProjectId: 'project-a' });
    persistCrawlRequestProfiles([profile]);
    expect(loadCrawlRequestProfiles()).toEqual([profile]);
    useProjectStore.setState({ activeProjectId: 'project-b' });
    expect(loadCrawlRequestProfiles()).toEqual([]);
    persistCrawlRequestProfiles([{ ...profile, name: 'Profile B' }]);
    useProjectStore.setState({ activeProjectId: 'project-a' });
    expect(loadCrawlRequestProfiles()).toEqual([profile]);
  });
});
