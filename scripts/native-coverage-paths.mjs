import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

/** Reject profiles compiled in a different checkout, even if suffixes match. */
export function assertNativeCoveragePaths(raw, workspace = process.cwd(), canonical = realpathSync) {
  let checked = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('SF:')) continue;
    const source = line.slice(3).replaceAll('\\', '/');
    const marker = 'src-tauri/src/';
    const index = source.lastIndexOf(marker);
    if (index < 0) continue;
    const relative = source.slice(index);
    if (relative.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('Invalid native coverage path');
    if (canonical(source) !== canonical(resolve(workspace, relative))) {
      throw new Error(`Native coverage belongs to a different checkout: ${source}`);
    }
    checked += 1;
  }
  if (!checked) throw new Error('No native source paths to verify');
  return checked;
}
