import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';

/** File symlinks need admin rights or Developer Mode on Windows; Linux and macOS always allow them. */
export const fileSymlinksSupported = ((): boolean => {
  const dir = mkdtempSync(join(tmpdir(), 'seomi-symlink-probe-'));
  try {
    writeFileSync(join(dir, 'target'), '');
    symlinkSync(join(dir, 'target'), join(dir, 'link'), 'file');
    return true;
  } catch {
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
})();

/**
 * Runs a symlink-escape test where the OS can create file symlinks. Skipped only on a local machine
 * without that right; in CI it always runs, so a missing capability fails loudly instead of hiding coverage.
 */
export const itWithFileSymlinks = it.skipIf(!fileSymlinksSupported && !process.env.CI);
