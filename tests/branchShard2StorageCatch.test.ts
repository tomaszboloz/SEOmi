import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  readJsonStorage: vi.fn(),
  readStorage: vi.fn(),
  writeJsonStorage: vi.fn(),
  writeStorage: vi.fn(),
  readJsonRecord: vi.fn(),
}));

vi.mock('@/services/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/storage')>()),
  readJsonStorage: storage.readJsonStorage,
  readStorage: storage.readStorage,
  writeJsonStorage: storage.writeJsonStorage,
  writeStorage: storage.writeStorage,
}));
vi.mock('@/services/storageContracts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/storageContracts')>()),
  readJsonRecord: storage.readJsonRecord,
}));

import { useUIStore } from '@/stores/uiStore';
import { loadSession as loadPerformanceSession, emptySession } from '@/components/Performance/performanceSession';
import { loadSession as loadClusteringSession } from '@/components/Keywords/keywordClustering/keywordClusteringStorage';

describe('storage read failures fall back to defaults', () => {
  beforeEach(() => {
    Object.values(storage).forEach((fn) => fn.mockReset());
    storage.readStorage.mockReturnValue(null);
  });

  it('uiStore returns no collapsed sections when the stored JSON read throws', () => {
    storage.readJsonStorage.mockImplementation(() => { throw new Error('storage unavailable'); });
    useUIStore.getState().hydrateSidebarSections('project-1');
    expect(useUIStore.getState().collapsedSections).toEqual({});
  });

  it('performance session returns the empty session when the read throws', () => {
    storage.readJsonStorage.mockImplementation(() => { throw new Error('boom'); });
    expect(loadPerformanceSession('project-1', 'https://example.com')).toEqual(emptySession('https://example.com'));
  });

  it('keyword clustering session returns defaults when the read throws', () => {
    storage.readJsonRecord.mockImplementation(() => { throw new Error('boom'); });
    const session = loadClusteringSession('project-1');
    expect(session.input).toBe('');
    expect(session.result).toBeNull();
  });
});
