import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { syncAppVersion } from '../scripts/sync-app-version.mjs';

const fixtures: string[] = [];
const targetFiles = (root: string) => ['package-lock.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'].map((file) => join(root, file));
const targetSnapshot = (root: string) => targetFiles(root).map((file) => readFileSync(file, 'utf8'));
const createFixture = (version: string, packageVersion = version) => {
  const root = mkdtempSync(join(tmpdir(), 'seomi-version-'));
  fixtures.push(root);
  mkdirSync(join(root, 'src-tauri'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'seomi', version: packageVersion }, null, 2));
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ name: 'seomi', version, lockfileVersion: 3, packages: { '': { name: 'seomi', version } } }, null, 2));
  writeFileSync(join(root, 'src-tauri', 'Cargo.toml'), `[package]\nname = "seomi"\nversion = "${version}"\n`);
  writeFileSync(join(root, 'src-tauri', 'Cargo.lock'), `version = 3\n\n[[package]]\nname = "seomi"\nversion = "${version}"\n`);
  return root;
};

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('application version synchronization', () => {
  it('propagates the package version to lockfiles and Cargo metadata', () => {
    const root = createFixture('0.0.3', '0.0.4');
    const result = syncAppVersion({ rootDir: root });

    expect(result.version).toBe('0.0.4');
    expect(result.changed).toHaveLength(3);
    expect(readFileSync(join(root, 'package-lock.json'), 'utf8')).toContain('"version": "0.0.4"');
    expect(readFileSync(join(root, 'src-tauri', 'Cargo.toml'), 'utf8')).toContain('version = "0.0.4"');
    expect(readFileSync(join(root, 'src-tauri', 'Cargo.lock'), 'utf8')).toContain('version = "0.0.4"');
  });

  it('reports drift without mutating files in check mode', () => {
    const root = createFixture('0.0.3', '0.0.4');
    const before = targetSnapshot(root);

    expect(() => syncAppVersion({ rootDir: root, check: true })).toThrow(/version drift/i);
    expect(targetSnapshot(root)).toEqual(before);
  });

  it('rejects an invalid canonical version before writing any target', () => {
    const root = createFixture('0.0.3', '0.0');
    const before = targetSnapshot(root);

    expect(() => syncAppVersion({ rootDir: root })).toThrow(/invalid package\.json version/i);
    expect(targetSnapshot(root)).toEqual(before);
  });

  it('updates only the package version and preserves dependency versions', () => {
    const root = createFixture('0.0.3', '0.0.4');
    const lockPath = join(root, 'package-lock.json');
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    lock.dependencies = { fixture: { version: '9.9.9' } };
    lock.packages['node_modules/fixture'] = { version: '9.9.9' };
    writeFileSync(lockPath, JSON.stringify(lock, null, 2));
    writeFileSync(join(root, 'src-tauri', 'Cargo.toml'), '[package]\nname = "seomi"\nversion = "0.0.3"\n[dependencies]\nfixture = { version = "9.9.9" }\n');

    syncAppVersion({ rootDir: root });

    const updatedLock = JSON.parse(readFileSync(lockPath, 'utf8'));
    expect(updatedLock.dependencies.fixture.version).toBe('9.9.9');
    expect(updatedLock.packages['node_modules/fixture'].version).toBe('9.9.9');
    expect(readFileSync(join(root, 'src-tauri', 'Cargo.toml'), 'utf8')).toContain('fixture = { version = "9.9.9" }');
  });

  it('keeps compact JSON and CRLF files unchanged when already synchronized', () => {
    const root = createFixture('0.0.4');
    const lockPath = join(root, 'package-lock.json');
    writeFileSync(lockPath, JSON.stringify(JSON.parse(readFileSync(lockPath, 'utf8'))));
    for (const file of targetFiles(root).slice(1)) {
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('\n', '\r\n'));
    }
    const before = targetSnapshot(root);

    expect(() => syncAppVersion({ rootDir: root, check: true })).not.toThrow();
    expect(targetSnapshot(root)).toEqual(before);
  });

  it('preserves CRLF when updating stale metadata', () => {
    const root = createFixture('0.0.3', '0.0.4');
    for (const file of targetFiles(root)) {
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('\n', '\r\n'));
    }

    syncAppVersion({ rootDir: root });

    for (const file of targetFiles(root)) {
      const contents = readFileSync(file, 'utf8');
      expect(contents).toContain('\r\n');
      expect(contents.replaceAll('\r\n', '')).not.toContain('\n');
    }
  });

  it('does not replace a dependency when Cargo package version is missing', () => {
    const root = createFixture('0.0.3', '0.0.4');
    writeFileSync(join(root, 'src-tauri', 'Cargo.toml'), '[package]\nname = "seomi"\n[dependencies]\nfixture = { version = "9.9.9" }\n');
    const before = targetSnapshot(root);

    expect(() => syncAppVersion({ rootDir: root })).toThrow(/Cargo\.toml is missing/i);
    expect(targetSnapshot(root)).toEqual(before);
  });

  it('rejects numeric prerelease identifiers with leading zeroes', () => {
    const root = createFixture('0.0.3', '0.0.4-01');
    const before = targetSnapshot(root);

    expect(() => syncAppVersion({ rootDir: root })).toThrow(/invalid package\.json version/i);
    expect(targetSnapshot(root)).toEqual(before);
  });
});
