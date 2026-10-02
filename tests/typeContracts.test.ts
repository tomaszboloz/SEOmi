import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { codeFiles } from '../scripts/check-max-loc.mjs';

const domains = ['ai.ts', 'audit.ts', 'backlinks.ts', 'crawl.ts', 'dataforseo.ts', 'gsc.ts', 'mcp.ts', 'research.ts', 'workspace.ts'];
const parse = (name: string) => ts.createSourceFile(name, readFileSync(`src/types/${name}`, 'utf8'), ts.ScriptTarget.Latest, true);
const modules = codeFiles('src/types').map(file => relative('src/types', file)).filter(file => file !== 'index.ts');

it('keeps the type barrel declaration-free and exports all domain contracts as types', () => {
  expect(readdirSync('src/types').filter((file) => file.endsWith('.ts') && file !== 'index.ts').sort()).toEqual(domains);
  const barrel = parse('index.ts');
  expect(barrel.statements).toHaveLength(domains.length);
  for (const statement of barrel.statements) {
    expect(ts.isExportDeclaration(statement)).toBe(true);
    if (ts.isExportDeclaration(statement)) expect(statement.isTypeOnly).toBe(true);
  }
});

it('preserves all 114 pre-refactor public type names and exact contract shapes', () => {
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  const signatures = modules.flatMap((name) => {
    const source = parse(name);
    return source.statements.flatMap((node) => ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
      ? [[node.name.text, printer.printNode(ts.EmitHint.Unspecified, node, source)]] : []);
  }).sort((a, b) => a[0].localeCompare(b[0]));
  expect(signatures).toHaveLength(114);
  expect(new Set(signatures.map(([name]) => name)).size).toBe(114);
  expect(createHash('sha256').update(JSON.stringify(signatures)).digest('hex'))
    .toBe('0dc108e2285391361ce07959b92ab87331255cd1bf176ff58adaa25ba46f035b');
});

it('allows only declarations and direct type imports/exports, with no circular module dependency', () => {
  const graph = new Map<string, string[]>();
  for (const name of modules) {
    const source = parse(name);
    const dependencies: string[] = [];
    for (const statement of source.statements) {
      expect(ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
        || ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)).toBe(true);
      if (ts.isImportDeclaration(statement)) {
        expect(statement.importClause?.isTypeOnly).toBe(true);
      }
      if (ts.isExportDeclaration(statement)) expect(statement.isTypeOnly).toBe(true);
      if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
        const specifier = statement.moduleSpecifier;
        expect(specifier && ts.isStringLiteral(specifier)).toBe(true);
        if (!specifier || !ts.isStringLiteral(specifier)) throw new Error('Missing direct type dependency');
        const target = join(dirname(name), specifier.text + '.ts');
        expect(modules).toContain(target);
        dependencies.push(target);
      }
    }
    graph.set(name, dependencies);
  }
  const visit = (name: string, path: string[]) => {
    expect(path, `Circular type dependency at ${name}`).not.toContain(name);
    for (const target of graph.get(name) ?? []) visit(target, [...path, name]);
  };
  for (const name of modules) visit(name, []);
});
