import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

function launch(profile: string | undefined, platform = 'win32') {
  const source = readFileSync('scripts/run-desktop-e2e.mjs', 'utf8')
    .split(/\r?\n/).filter(line => !/^import\b/.test(line)).join('\n');
  const compile = vi.fn((_command: string, _args: string[], _options: unknown) => ({ status: 0 }));
  const callbacks: Record<string, (...args: unknown[]) => void> = {};
  const spawn = vi.fn((_command: string, _args: string[], _options: unknown) => ({ on: (event: string, cb: (...args: unknown[]) => void) => { callbacks[event] = cb; } }));
  const copy = vi.fn();
  const runtime = { platform, env: { SEOMI_E2E_PROFILE: profile, CARGO_TARGET_DIR: '/external/cargo' }, exit: vi.fn() };
  runInNewContext(source, {
    process: runtime, spawnSync: compile, spawn,
    console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
    mkdtempSync: () => '/tmp/e2e', tmpdir: () => '/tmp',
    join: (...parts: string[]) => parts.join('/'), resolve: (...parts: string[]) => parts.join('/'),
    readFileSync: () => '{"passed":true}', mkdirSync: vi.fn(), copyFileSync: copy, rmSync: vi.fn(),
    setTimeout: () => 1, clearTimeout: vi.fn(),
  });
  callbacks.exit?.(0);
  return { compile, spawn, copy };
}

it('builds and launches the release executable and preserves its separate report', () => {
  const { compile, spawn, copy } = launch('release');
  expect(compile.mock.calls[0]).toEqual(['cargo', expect.arrayContaining(['--release', '--features', 'custom-protocol,test-fixture']), expect.anything()]);
  expect(spawn.mock.calls[0][0]).toBe('/external/cargo/release/examples/desktop_e2e.exe');
  expect(copy.mock.calls[0][1]).toBe('test-results/desktop-e2e-release.json');
});

it('retains the existing debug profile and report by default', () => {
  const { compile, spawn, copy } = launch(undefined, 'darwin');
  expect(compile.mock.calls[0][1]).not.toContain('--release');
  expect(spawn.mock.calls[0][0]).toBe('/external/cargo/debug/examples/desktop_e2e');
  expect(copy.mock.calls[0][1]).toBe('test-results/desktop-e2e.json');
});

it('rejects invalid profiles instead of silently testing a different build', () => {
  expect(() => launch('relese')).toThrow('Unsupported desktop E2E profile');
});
