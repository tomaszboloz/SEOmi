import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';

export const normalize = file => relative(process.cwd(), resolve(file)).replaceAll('\\', '/');

export const position = (source, offset) => {
  const result = source.getLineAndCharacterOfPosition(offset);
  return { line: result.line + 1, column: result.character };
};

export const compare = (left, right) => left.line - right.line || left.column - right.column;

export function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(?:ts|tsx|mjs)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  }).sort();
}

export function sourceHashes(files) {
  return Object.fromEntries(files.map(file => [normalize(file), createHash('sha256').update(readFileSync(file)).digest('hex')]));
}
