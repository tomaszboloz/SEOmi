import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('routes native IPC dispatch and background failures through structured logging', () => {
  const entry = readFileSync('src-tauri/src/lib.rs', 'utf8');
  expect(entry).toContain('utils::logging::init()');
  expect(entry).toContain('utils::logging::dispatch');
  expect(entry).not.toMatch(/log::error!\([^;]*\{error\}/s);
  const storage = readFileSync('src-tauri/src/commands/crawl_storage.rs', 'utf8');
  expect(storage).not.toMatch(/log::warn!\([^;]*\{error\}/s);
});

it('keeps the native log allowlist synchronized with registered IPC commands', () => {
  const entry = readFileSync('src-tauri/src/lib.rs', 'utf8');
  const handler = entry.slice(entry.indexOf('tauri::generate_handler!'), entry.indexOf('.setup'));
  const registered = [...handler.matchAll(/commands::\w+::(\w+),/g)].map((match) => match[1]);
  const list = readFileSync('src-tauri/src/utils/logging/commands.rs', 'utf8');
  const logged = [...list.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
  expect(registered.length).toBeGreaterThan(0);
  expect(logged.sort()).toEqual(registered.sort());
});
