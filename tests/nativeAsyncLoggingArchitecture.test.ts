import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('enables native Tauri execution spans and keeps them under the dispatcher correlation', () => {
  const manifest = readFileSync('src-tauri/Cargo.toml', 'utf8');
  expect(manifest).toMatch(/tauri = .*features = \[.*"tracing"/);
  const source = readFileSync('src-tauri/src/utils/logging.rs', 'utf8');
  expect(source).toContain('"seomi.ipc"');
  expect(source).toContain('NativeTaskLayer');
  expect(source).toContain('task_duration_ms');
});
