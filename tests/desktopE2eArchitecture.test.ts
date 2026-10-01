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

it('embeds Common Controls v6 into Windows examples before their imports are loaded', () => {
  const build = readFileSync('src-tauri/build.rs', 'utf8');
  expect(build).toContain('cargo:rustc-link-arg-examples=/MANIFEST:EMBED');
  expect(build).toContain('cargo:rustc-link-arg-examples=/MANIFESTINPUT:');
  expect(build).toContain('CARGO_CFG_TARGET_OS');
  expect(build).toContain('CARGO_CFG_TARGET_ENV');
  const manifest = readFileSync('src-tauri/windows-examples.manifest', 'utf8');
  expect(manifest).toContain('name="Microsoft.Windows.Common-Controls"');
  expect(manifest).toContain('version="6.0.0.0"');
});
