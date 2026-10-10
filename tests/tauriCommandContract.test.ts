import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');
const rustEntryPoint = resolve(process.cwd(), 'src-tauri/src/lib.rs');
const sourceCache = new Map<string, string>();
const readSource = (path: string): string => {
  if (!sourceCache.has(path)) sourceCache.set(path, readFileSync(path, 'utf8'));
  return sourceCache.get(path)!;
};

const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return sourceFiles(path);
  return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [path] : [];
});

const frontendCommands = (path: string): Set<string> => {
  const source = readSource(path);
  return new Set([...source.matchAll(/invokeTauriCommand(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]/g)]
    .map((match) => match[1]));
};

const fallbackDesktopCommands = (): Set<string> => {
  const source = readSource(resolve(sourceRoot, 'services/tauri/browserFallback.ts'));
  const block = source.match(/const desktopOnlyCommands = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
  return new Set([...block.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]));
};

const registeredCommands = (): Set<string> => {
  const source = readSource(rustEntryPoint);
  const handler = source.match(/generate_handler!\[([\s\S]*?)\]/)?.[1] ?? '';
  return new Set([...handler.matchAll(/::([A-Za-z_][A-Za-z0-9_]*)\s*,/g)].map((match) => match[1]));
};

describe('Tauri IPC command contract', () => {
  const paths = sourceFiles(sourceRoot);
  it('discovers the full frontend source tree', () => {
    expect(paths.length).toBeGreaterThan(100);
    expect(registeredCommands().size).toBeGreaterThan(30);
  });

  it.each(paths)('registers frontend commands from %s', (path) => {
    const registered = registeredCommands();
    const missing = [...frontendCommands(path)].filter((command) => !registered.has(command)).sort();
    expect(missing).toEqual([]);
  });

  it('registers PDF commands passed through the typed export helper', () => {
    const commands = paths.flatMap(path => [...readSource(path)
      .matchAll(/downloadPdf\(\s*['"]([^'"]+)['"]/g)].map(match => match[1]));
    expect(commands.length).toBeGreaterThan(0);
    const registered = registeredCommands();
    expect(commands.filter(command => !registered.has(command))).toEqual([]);
  });

  it('registers every desktop-only browser-fallback command in the native invoke handler', () => {
    const registered = registeredCommands();
    expect(fallbackDesktopCommands().size).toBeGreaterThan(30);
    const missing = [...fallbackDesktopCommands()].filter((command) => !registered.has(command)).sort();
    expect(missing).toEqual([]);
  });

  it('keeps the native entrypoint readable during source discovery', () => {
    expect(statSync(rustEntryPoint).isFile()).toBe(true);
  });
});
