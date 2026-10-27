import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const shaA = 'a'.repeat(40);
export const shaB = 'b'.repeat(40);

export function createPackageFixture(version: string) {
  const dir = mkdtempSync(join(tmpdir(), 'seomi-cli-test-'));
  const pkgPath = join(dir, 'package.json');
  writeFileSync(pkgPath, JSON.stringify({ name: 'seomi', version }), 'utf8');
  return { pkgPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

export function mockFetch(handlers: Record<string, { status?: number; data: unknown }>): typeof fetch {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    const handler = Object.entries(handlers).find(([k]) => url.includes(k));
    if (!handler) return { ok: false, status: 404, json: async () => ({}) } as Response;
    const { status = 200, data } = handler[1];
    return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
  };
}
