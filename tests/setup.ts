// Vitest setup file
import { afterEach, vi } from 'vitest';

// jsdom has no canvas: Cytoscape is replaced by a recorder in every test file.
vi.mock('cytoscape', () => import('./fixtures/fakeCytoscape'));

afterEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
