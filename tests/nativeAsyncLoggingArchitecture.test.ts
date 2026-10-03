import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('enables native Tauri execution spans and keeps them under the dispatcher correlation', () => {
  const manifest = readFileSync('src-tauri/Cargo.toml', 'utf8');
  expect(manifest).toMatch(/tauri = .*features = \[.*"tracing"/);
  const root = 'src-tauri/src/utils/logging/';
  expect(readFileSync(`${root}dispatch.rs`, 'utf8')).toContain('"seomi.ipc"');
  expect(readFileSync(`${root}layer.rs`, 'utf8')).toContain('NativeTaskLayer');
  expect(readFileSync(`${root}layer.rs`, 'utf8')).toContain('task_duration_ms');
});
