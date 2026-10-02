// @vitest-environment node
import { expect, it } from 'vitest';
import { join } from 'node:path';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

it('keeps scheduler IPC, both OS backends, manifests, parsing and native tests within LOC150', () => {
  const files = ['src-tauri/src/commands/scheduler.rs',
    ...codeFiles('src-tauri/src/commands/scheduler')];
  expect(files.length).toBeGreaterThan(10);
  expect(files).toContain(join('src-tauri/src/commands/scheduler', 'windows.rs'));
  expect(files).toContain(join('src-tauri/src/commands/scheduler', 'macos.rs'));
  expect(maxLocReport(files).violations).toEqual([]);
});
