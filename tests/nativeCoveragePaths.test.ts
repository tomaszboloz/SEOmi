import { expect, it } from 'vitest';
import { assertNativeCoveragePaths } from '../scripts/native-coverage-paths.mjs';

it('accepts source paths from the canonical workspace and ignores external build targets', () => {
  const identity = (path: string) => path;
  expect(assertNativeCoveragePaths('SF:/repo/src-tauri/src/lib.rs\nSF:/repo/src-tauri/examples/e2e.rs\n', '/repo', identity)).toBe(1);
  expect(assertNativeCoveragePaths('SF:/alias/src-tauri/src/lib.rs\n', '/repo', (path: string) => path.replace('/alias/', '/repo/'))).toBe(1);
});

it('rejects an isolated checkout whose relative source suffix matches the real workspace', () => {
  expect(() => assertNativeCoveragePaths('SF:/tmp/base/src-tauri/src/lib.rs\n', '/repo', (path: string) => path)).toThrow('different checkout');
  expect(() => assertNativeCoveragePaths('SF:/repo/src-tauri/src/../lib.rs\n', '/repo', (path: string) => path)).toThrow('Invalid native');
  expect(() => assertNativeCoveragePaths('SF:/repo/src-tauri/examples/e2e.rs\n', '/repo', (path: string) => path)).toThrow('No native');
});
