import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectStore, normalizePersistedProjects } from '@/stores/projectStore';
import * as storage from '@/services/storage';

vi.mock('@/services/storage', () => ({
  readJsonStorage: vi.fn(),
  readStorage: vi.fn(),
  writeJsonStorage: vi.fn(),
  writeStorage: vi.fn(),
}));

const readJson = vi.mocked(storage.readJsonStorage);
const readStr = vi.mocked(storage.readStorage);
const writeJson = vi.mocked(storage.writeJsonStorage);
const writeStr = vi.mocked(storage.writeStorage);

beforeEach(() => {
  vi.clearAllMocks();
  writeJson.mockReturnValue(true);
  writeStr.mockReturnValue(true);
});

describe('projectStore concurrency, rapid switching, and boundary normalization', () => {
  it('normalizes malformed persisted projects safely', () => {
    const raw = [
      null,
      {},
      { id: '', name: 'Empty ID' },
      { id: 'proj-1', name: 'Valid Project', rootUrl: 'https://example.com' },
      { id: 'proj-1', name: 'Duplicate ID', rootUrl: 'https://example.org' },
    ];
    const normalized = normalizePersistedProjects(raw, '2026-01-01T00:00:00.000Z');
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({ id: 'proj-1', name: 'Valid Project', rootUrl: 'https://example.com' });
  });

  it('handles rapid active project switching and state isolation during pending operations', async () => {
    const p1 = { id: 'p1', name: 'Alpha', rootUrl: 'https://alpha.com', createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-01T00:00:00.000Z' };
    const p2 = { id: 'p2', name: 'Beta', rootUrl: 'https://beta.com', createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-01T00:00:00.000Z' };

    readJson.mockReturnValue([p1, p2]);
    readStr.mockReturnValue('p1');

    useProjectStore.setState({ projects: [p1, p2], activeProjectId: 'p1' });

    // Simulate rapid concurrent switches
    const switch1 = Promise.resolve().then(() => useProjectStore.getState().selectProject('p2'));
    const switch2 = Promise.resolve().then(() => useProjectStore.getState().selectProject('p1'));
    const switch3 = Promise.resolve().then(() => useProjectStore.getState().selectProject('p2'));

    await Promise.all([switch1, switch2, switch3]);

    expect(useProjectStore.getState().activeProjectId).toBe('p2');
    expect(writeJson).toHaveBeenCalled();
    expect(writeStr).toHaveBeenCalledWith('seomi_active_project_v1', 'p2');
  });

  it('throws storage error when persistence fails during project creation', () => {
    readJson.mockReturnValue([]);
    readStr.mockReturnValue(null);
    useProjectStore.setState({ projects: [], activeProjectId: null });
    writeJson.mockReturnValueOnce(false);

    expect(() => {
      useProjectStore.getState().createProject({ name: 'New Workspace', rootUrl: 'https://new.com' });
    }).toThrow();
  });
});
