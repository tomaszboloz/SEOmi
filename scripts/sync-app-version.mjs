import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const paths = (rootDir) => ({
  package: join(rootDir, 'package.json'),
  lock: join(rootDir, 'package-lock.json'),
  cargo: join(rootDir, 'src-tauri', 'Cargo.toml'),
  cargoLock: join(rootDir, 'src-tauri', 'Cargo.lock'),
});

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const packageLockWithVersion = (path, version) => {
  const source = readFileSync(path, 'utf8');
  const lock = JSON.parse(source);
  if (!lock.packages || !lock.packages['']) {
    throw new Error('package-lock.json is missing its root package entry.');
  }
  if (lock.version === version && lock.packages[''].version === version) return source;
  lock.version = version;
  lock.packages[''].version = version;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const trailing = source.endsWith('\r\n') || source.endsWith('\n') ? newline : '';
  return `${JSON.stringify(lock, null, 2).replaceAll('\n', newline)}${trailing}`;
};

const cargoVersion = (contents, version) => {
  const header = /^\[package\][ \t]*(?:\r?\n|$)/m.exec(contents);
  if (!header) throw new Error('Cargo.toml is missing the package version.');
  const bodyStart = header.index + header[0].length;
  const rest = contents.slice(bodyStart);
  const nextHeader = /^\[[^\r\n]+\][ \t]*(?:\r?\n|$)/m.exec(rest);
  const sectionEnd = nextHeader ? bodyStart + nextHeader.index : contents.length;
  const section = contents.slice(header.index, sectionEnd);
  const versionMatch = /^version[ \t]*=[ \t]*"[^"]+"/m.exec(section);
  if (!versionMatch) throw new Error('Cargo.toml is missing the package version.');
  const replacement = `version = "${version}"`;
  const updatedSection = section.slice(0, versionMatch.index) + replacement + section.slice(versionMatch.index + versionMatch[0].length);
  return contents.slice(0, header.index) + updatedSection + contents.slice(sectionEnd);
};

const cargoLockVersion = (contents, version) => {
  const match = /(\[\[package\]\][\r\n]+name\s*=\s*"seomi"[\r\n]+version\s*=\s*)"[^"]+"/.exec(contents);
  if (!match) throw new Error('Cargo.lock is missing the seomi package version.');
  return contents.slice(0, match.index) + match[1] + `"${version}"` + contents.slice(match.index + match[0].length);
};

const readVersion = (rootDir) => {
  const version = readJson(paths(rootDir).package).version;
  const prerelease = typeof version === 'string' ? version.split('+')[0].split('-')[1] : undefined;
  const hasLeadingZero = prerelease?.split('.').some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0'));
  if (typeof version !== 'string' || !semver.test(version) || hasLeadingZero) {
    throw new Error(`Invalid package.json version: ${String(version)}`);
  }
  return version;
};

export function syncAppVersion({ rootDir = projectRoot, check = false } = {}) {
  const resolvedRoot = resolve(rootDir);
  const targetPaths = paths(resolvedRoot);
  const version = readVersion(resolvedRoot);
  const current = new Map([
    [targetPaths.lock, readFileSync(targetPaths.lock, 'utf8')],
    [targetPaths.cargo, readFileSync(targetPaths.cargo, 'utf8')],
    [targetPaths.cargoLock, readFileSync(targetPaths.cargoLock, 'utf8')],
  ]);
  const next = new Map([
    [targetPaths.lock, packageLockWithVersion(targetPaths.lock, version)],
    [targetPaths.cargo, cargoVersion(current.get(targetPaths.cargo), version)],
    [targetPaths.cargoLock, cargoLockVersion(current.get(targetPaths.cargoLock), version)],
  ]);
  const changed = [...next.keys()].filter((path) => next.get(path) !== current.get(path));
  if (check && changed.length > 0) {
    throw new Error(`Application version drift detected in: ${changed.map((path) => path.slice(resolvedRoot.length + 1)).join(', ')}`);
  }
  if (!check) {
    for (const path of changed) writeFileSync(path, next.get(path), 'utf8');
  }
  return { version, changed };
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const check = process.argv.includes('--check');
    const result = syncAppVersion({ check });
    console.log(check ? `Version ${result.version} is synchronized.` : `Synchronized version ${result.version}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
