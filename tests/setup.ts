// Vitest setup file
import { afterEach } from 'vitest';

afterEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
