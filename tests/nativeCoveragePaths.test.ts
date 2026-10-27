import { expect, it } from 'vitest';
import { resolve } from 'node:path';
import { assertNativeCoveragePaths } from '../scripts/native-coverage-paths.mjs';

const workspace = resolve('coverage-workspace');
const source = (base: string, suffix = 'src/lib.rs') => resolve(base, 'src-tauri', suffix);
const canonical = (path: string) => resolve(path);

it('accepts source paths from the canonical workspace and ignores external build targets', () => {
  expect(assertNativeCoveragePaths(`SF:${source(workspace)}\nSF:${source(workspace, 'examples/e2e.rs')}\n`, workspace, canonical)).toBe(1);
  const alias = resolve('coverage-alias');
  expect(assertNativeCoveragePaths(`SF:${source(alias)}\n`, workspace, (path: string) => canonical(path).replace(alias, workspace))).toBe(1);
});

it('normalizes Windows separators and CRLF before checking workspace ownership', () => {
  const windows = source(workspace).replaceAll('/', '\\');
  expect(assertNativeCoveragePaths(`SF:${windows}\r\n`, workspace, canonical)).toBe(1);
});

it('rejects an isolated checkout whose relative source suffix matches the real workspace', () => {
  expect(() => assertNativeCoveragePaths(`SF:${source(resolve('other-checkout'))}\n`, workspace, canonical)).toThrow('different checkout');
  expect(() => assertNativeCoveragePaths(`SF:${workspace}/src-tauri/src/../lib.rs\n`, workspace, canonical)).toThrow('Invalid native');
  expect(() => assertNativeCoveragePaths(`SF:${source(workspace, 'examples/e2e.rs')}\n`, workspace, canonical)).toThrow('No native');
});
