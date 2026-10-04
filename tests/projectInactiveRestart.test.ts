import { afterEach, expect, it, vi } from 'vitest';

const project = (id: string) => ({ id, name: id, rootUrl: 'https://example.test', createdAt: '2026-10-01T00:00:00.000Z', lastOpenedAt: '2026-10-01T00:00:00.000Z' });
afterEach(() => { localStorage.clear(); });

it.each(['source', 'missing'] as const)('retains the persisted %s selection without activating an imported catalog entry on restart', async (active) => {
  localStorage.clear(); vi.resetModules();
  const catalog = [project('inactive-import'), project('source')];
  localStorage.setItem('seomi_projects_v1', JSON.stringify(catalog));
  localStorage.setItem('seomi_active_project_v1', active);
  const { useProjectStore } = await import('@/stores/projectStore');
  expect(useProjectStore.getState().projects).toEqual(catalog);
  expect(useProjectStore.getState().activeProjectId).toBe(active === 'source' ? 'source' : null);
  expect(localStorage.getItem('seomi_active_project_v1')).toBe(active);
});
