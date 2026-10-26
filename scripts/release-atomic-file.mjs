import { closeSync, constants, fstatSync, mkdtempSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { isPathWithin } from './release-artifact-paths.mjs';

export const readReleaseFile = (file, artifactDir) => {
  const root = realpathSync(artifactDir), canonical = realpathSync(file);
  if (!isPathWithin(root, canonical)) throw new Error('Release file path escape');
  const fd = openSync(canonical, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd, { bigint: true }), current = statSync(canonical, { bigint: true });
    if (!opened.isFile() || !isPathWithin(root, realpathSync(canonical)) || opened.dev !== current.dev || opened.ino !== current.ino) {
      throw new Error('Release file changed during open');
    }
    return readFileSync(fd);
  } finally { closeSync(fd); }
};

export const writeReleaseFileAtomically = (destination, content) => {
  const directory = realpathSync(dirname(resolve(destination)));
  const temporary = mkdtempSync(join(directory, '.seomi-write-'));
  try {
    const payload = join(temporary, 'payload');
    writeFileSync(payload, content, { flag: 'wx', mode: 0o600 });
    // Rename replaces the destination entry; it never follows a swapped symlink.
    renameSync(payload, join(directory, basename(destination)));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
};
