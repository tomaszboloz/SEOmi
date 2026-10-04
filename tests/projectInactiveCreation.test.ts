import { beforeEach, expect, it } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ ...useProjectStore.getInitialState(), projects: [], activeProjectId: null });
});
it('creates an inactive persisted project without selecting it, then supports explicit activation', () => {
  const project = useProjectStore.getState().createProject({ name: 'Imported', activate: false });
  expect(useProjectStore.getState().projects).toEqual([project]);
  expect(useProjectStore.getState().activeProjectId).toBeNull();
  expect(JSON.parse(localStorage.getItem('seomi_projects_v1')!)).toEqual([project]);
  expect(localStorage.getItem('seomi_active_project_v1')).toBeNull();
  useProjectStore.getState().selectProject(project.id);
  expect(useProjectStore.getState().activeProjectId).toBe(project.id);
  expect(localStorage.getItem('seomi_active_project_v1')).toBe(project.id);
});
it('preserves current selection during inactive creation and keeps default activation behavior', () => {
  const source = useProjectStore.getState().createProject({ name: 'Source' });
  const inactive = useProjectStore.getState().createProject({ name: 'Inactive', activate: false });
  expect(useProjectStore.getState().activeProjectId).toBe(source.id);
  expect(localStorage.getItem('seomi_active_project_v1')).toBe(source.id);
  expect(useProjectStore.getState().projects.map(project => project.id)).toEqual([inactive.id, source.id]);
  const active = useProjectStore.getState().createProject({ name: 'Active' });
  expect(useProjectStore.getState().activeProjectId).toBe(active.id);
});
