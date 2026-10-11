import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('scripts/run-desktop-e2e.mjs', 'utf8').replace(/^import .*;\n/gm, '');

function run(platform: string, code: number | null, passed: boolean, timedOut = false) {
  const callbacks: Record<string, (...args: unknown[]) => void> = {};
  let timeout: (() => void) | undefined;
  const runtime = { platform, env: {}, exit: vi.fn(), exitCode: undefined as number | undefined };
  const child = { on: (event: string, callback: (...args: unknown[]) => void) => { callbacks[event] = callback; }, kill: vi.fn() };
  runInNewContext(source, {
    process: runtime,
    console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    spawnSync: () => ({ status: 0 }), spawn: () => child,
    mkdtempSync: () => '/tmp/fixture', tmpdir: () => '/tmp',
    join: (...parts: string[]) => parts.join('/'), resolve: (...parts: string[]) => parts.join('/'),
    readFileSync: () => JSON.stringify({ passed }),
    mkdirSync: vi.fn(), copyFileSync: vi.fn(), rmSync: vi.fn(),
    setTimeout: (callback: () => void) => { timeout = callback; return 1; }, clearTimeout: vi.fn(),
  });
  if (timedOut) timeout?.();
  callbacks.exit(code);
  return runtime.exitCode;
}

describe('desktop runner process boundary', () => {
  it.each(['win32', 'darwin', 'linux'])('requires a successful report and clean exit on %s', platform => {
    expect(run(platform, 0, true)).toBe(0);
    expect(run(platform, 0, false)).toBe(1);
    expect(run(platform, 0, true, true)).toBe(1);
    for (const code of [1, 2, 3221225785, null]) {
      expect(run(platform, code, true)).toBe(1);
    }
  });
});
