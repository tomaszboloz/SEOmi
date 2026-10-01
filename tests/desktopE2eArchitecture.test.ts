import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('runs the production desktop builder with a separate native E2E harness', () => {
  const source = readFileSync('src-tauri/src/lib.rs', 'utf8');
  expect(source).toContain('pub fn desktop_builder()');
  const harness = readFileSync('src-tauri/examples/desktop_e2e.rs', 'utf8');
  expect(harness).toContain('seomi_lib::desktop_builder()');
  expect(harness).toContain('data_store_identifier');
  expect(harness).toContain('com.seomi.desktop.e2e.');
  expect(source).not.toContain('include_str!("../examples/desktop_e2e.js")');
});
