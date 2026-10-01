import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');
const rustEntryPoint = resolve(process.cwd(), 'src-tauri/src/lib.rs');

const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return sourceFiles(path);
  return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [path] : [];
});

const frontendCommands = (): Set<string> => {
  const commands = new Set<string>();
  for (const path of sourceFiles(sourceRoot)) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/invokeTauriCommand(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]/g)) {
      commands.add(match[1]);
    }
  }

  // PDF exports pass the command through a typed helper rather than calling
  // invokeTauriCommand at the call site.
  const exportSource = readFileSync(resolve(sourceRoot, 'services/export.ts'), 'utf8');
  for (const match of exportSource.matchAll(/downloadPdf\(['"]([^'"]+)['"]/g)) {
    commands.add(match[1]);
  }
  return commands;
};

const fallbackDesktopCommands = (): Set<string> => {
  const source = readFileSync(resolve(sourceRoot, 'services/tauri.ts'), 'utf8');
  const block = source.match(/const desktopOnlyCommands = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
  return new Set([...block.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]));
};

const registeredCommands = (): Set<string> => {
  const source = readFileSync(rustEntryPoint, 'utf8');
  const handler = source.match(/generate_handler!\[([\s\S]*?)\]/)?.[1] ?? '';
  return new Set([...handler.matchAll(/::([A-Za-z_][A-Za-z0-9_]*)\s*,/g)].map((match) => match[1]));
};

describe('Tauri IPC command contract', () => {
  it('registers every frontend command in the native invoke handler', () => {
    const registered = registeredCommands();
    const missing = [...frontendCommands()].filter((command) => !registered.has(command)).sort();
    expect(missing).toEqual([]);
  });

  it('registers every desktop-only browser-fallback command in the native invoke handler', () => {
    const registered = registeredCommands();
    const missing = [...fallbackDesktopCommands()].filter((command) => !registered.has(command)).sort();
    expect(missing).toEqual([]);
  });

  it('keeps the native entrypoint readable during source discovery', () => {
    expect(statSync(rustEntryPoint).isFile()).toBe(true);
  });
});
