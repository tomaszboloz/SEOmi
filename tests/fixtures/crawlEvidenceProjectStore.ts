import { vi } from 'vitest';

export const selectProject = vi.fn();
export const projectStore = { getState: () => ({ projects: [{ id: 'one' }, { id: 'two' }], selectProject }) };
