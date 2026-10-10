import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { normalizePersistedProjects, useProjectStore } from '@/stores/projectStore';
import { validateProjectRootUrl } from '@/services/projectValidation';
import {
  isStorageAvailable,
  readStorage,
  readStorageEntries,
  removeStorage,
  writeStorage,
  writeStorageResult,
} from '@/services/storage';

const initialStore = useProjectStore.getState();
const project = (id: string) => ({
  id, name: id.toUpperCase(), rootUrl: `https://${id}.example`,
  createdAt: '2026-10-01T00:00:00.000Z', lastOpenedAt: '2026-10-01T00:00:00.000Z',
});

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ projects: [project('a'), project('b')], activeProjectId: 'a' });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  useProjectStore.setState(initialStore);
});

describe('project persistence defensive branches', () => {
  it('normalizes non-object records, optional roots, and non-string dates', () => {
    const now = '2026-10-05T12:00:00.000Z';
    expect(normalizePersistedProjects([
      null, [], { id: 'missing-name', name: '' },
      { id: 'optional-root', name: 'Optional root', createdAt: 7, lastOpenedAt: ' ' },
      { id: 'valid', name: 'Valid', rootUrl: 'example.com', createdAt: 7, lastOpenedAt: null },
    ], now)).toEqual([
      { id: 'optional-root', name: 'Optional root', rootUrl: undefined, createdAt: now, lastOpenedAt: now },
      { id: 'valid', name: 'Valid', rootUrl: 'https://example.com', createdAt: now, lastOpenedAt: now },
    ]);
  });

  it('reports a parser result without a hostname as an invalid URL', () => {
    vi.stubGlobal('URL', class {
      protocol = 'https:';
      hostname = '';
      username = '';
      password = '';
      constructor(_input: string) {}
    });
    expect(validateProjectRootUrl('example.com')).toEqual({
      ok: false, message: i18n.t('projects.validation.invalidUrl'),
    });
  });

  it('returns safe results when durable storage is absent', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readStorage('missing')).toBeNull();
    expect(isStorageAvailable()).toBe(false);
    expect(writeStorageResult('missing', 'value')).toEqual({ ok: false });
    expect(writeStorage('missing', 'value')).toBe(false);
    expect(removeStorage('missing')).toBe(false);
    expect(readStorageEntries('seomi_project_')).toEqual({});
  });

  it('skips null and foreign keys while retaining project-prefixed entries', () => {
    const keys = [null, 'foreign', 'seomi_project_a_value'];
    const values = new Map([['foreign', 'ignore'], ['seomi_project_a_value', 'keep']]);
    vi.stubGlobal('localStorage', {
      get length() { return keys.length; },
      key: (index: number) => keys[index],
      getItem: (key: string) => values.get(key) ?? null,
    });
    expect(readStorageEntries('seomi_project_')).toEqual({ a_value: 'keep' });
  });

  it('keeps the in-memory catalog unchanged when its write fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === 'seomi_projects_v1') throw new Error('quota');
    });
    const before = useProjectStore.getState();
    expect(() => before.createProject({ name: 'New project', rootUrl: 'https://new.example' }))
      .toThrow(i18n.t('runtimeErrors.persistence.workspaceUnavailable'));
    expect(useProjectStore.getState().projects).toEqual(before.projects);
    expect(useProjectStore.getState().activeProjectId).toBe(before.activeProjectId);
  });

  it('does not switch projects when only the active marker write fails', () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'seomi_active_project_v1') throw new Error('quota');
      return original.call(this, key, value);
    });
    const before = useProjectStore.getState();
    expect(() => before.selectProject('b')).toThrow(i18n.t('runtimeErrors.persistence.workspaceUnavailable'));
    expect(useProjectStore.getState().projects).toEqual(before.projects);
    expect(useProjectStore.getState().activeProjectId).toBe('a');
  });

  it('covers non-array storage, non-string project ids, and invalid rootUrls in createProject', () => {
    expect(normalizePersistedProjects(null)).toEqual([]);
    expect(normalizePersistedProjects('not-an-array')).toEqual([]);
    expect(normalizePersistedProjects([{ id: 123 as never, name: 456 as never }])).toEqual([]);
    expect(() => useProjectStore.getState().createProject({ name: 'Valid Project', rootUrl: 'not a valid url' })).toThrow();
  });
});
