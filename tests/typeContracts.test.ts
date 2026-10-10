import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { codeFiles } from '../scripts/check-max-loc.mjs';

const domains = ['ai.ts', 'audit.ts', 'backlinks.ts', 'crawl.ts', 'dataforseo.ts', 'gsc.ts', 'mcp.ts', 'research.ts', 'workspace.ts'];
const parse = (name: string) => ts.createSourceFile(name, readFileSync(`src/types/${name}`, 'utf8'), ts.ScriptTarget.Latest, true);
const modules = codeFiles('src/types').map(file => relative('src/types', file)).filter(file => file !== 'index.ts');
// Optional fields added after the refactor; each has its own additive-contract test below.
const additive: Record<string, string[]> = {
  SecurityHeaders: ['content_security_policy_report_only', 'repeated_headers'],
  GscPerformanceData: ['query_pages', 'query_pages_may_be_truncated'],
  CrawledPageSummary: ['semantic_language'],
  SiteCrawlResult: ['score_version', 'robots_txt_evaluation_status', 'robots_txt_warning', 'robots_txt_status_code', 'robots_txt_final_url', 'robots_txt_redirect_chain'],
};

it('keeps the type barrel declaration-free and exports all domain contracts as types', () => {
  expect(readdirSync('src/types').filter((file) => file.endsWith('.ts') && file !== 'index.ts').sort()).toEqual(domains);
  const barrel = parse('index.ts');
  expect(barrel.statements).toHaveLength(domains.length);
  for (const statement of barrel.statements) {
    expect(ts.isExportDeclaration(statement)).toBe(true);
    if (ts.isExportDeclaration(statement)) expect(statement.isTypeOnly).toBe(true);
  }
});

it('adds optional report-only and repeated header evidence to legacy security reports', () => {
  const source = parse('audit/security.ts');
  const declaration = source.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === 'SecurityHeaders');
  if (!declaration || !ts.isInterfaceDeclaration(declaration)) throw new Error('Missing security header contract');
  for (const [name, type] of [['content_security_policy_report_only', 'string'], ['repeated_headers', 'Record<string, string[]>']]) {
    const field = declaration.members.find(member => member.name?.getText(source) === name);
    if (!field || !ts.isPropertySignature(field)) throw new Error(`Missing observed field ${name}`);
    expect(field.questionToken).toBeDefined();
    expect(field.type?.getText(source)).toBe(type);
  }
});

it('preserves the reviewed 117 contracts including suggestion provenance and unknown metrics', () => {
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  const signatures = modules.flatMap((name) => {
    const source = parse(name);
    return source.statements.flatMap((node) => ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
      ? [[node.name.text, printer.printNode(ts.EmitHint.Unspecified,
        ts.isInterfaceDeclaration(node) && additive[node.name.text]
          ? ts.factory.updateInterfaceDeclaration(node, node.modifiers, node.name, node.typeParameters,
            node.heritageClauses, node.members.filter(member => !member.name
              || !additive[node.name.text].includes(member.name.getText(source))))
          : node, source)]] : []);
  }).sort((a, b) => a[0].localeCompare(b[0]));
  expect(signatures).toHaveLength(117);
  expect(new Set(signatures.map(([name]) => name)).size).toBe(117);
  expect(createHash('sha256').update(JSON.stringify(signatures)).digest('hex'))
    .toBe('163a51f14549fe83ce6243f63f477ee99547b5854c084e1040a95730b0773fd2');
});

it('adds only optional observed query/page fields to the legacy GSC contract', () => {
  const source = parse('gsc.ts');
  const data = source.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === 'GscPerformanceData');
  if (!data || !ts.isInterfaceDeclaration(data)) throw new Error('Missing GSC contract');
  const pairs = data.members.find(member => member.name?.getText(source) === 'query_pages');
  const truncated = data.members.find(member => member.name?.getText(source) === 'query_pages_may_be_truncated');
  if (!pairs || !truncated || !ts.isPropertySignature(pairs) || !ts.isPropertySignature(truncated)) throw new Error('Missing additive fields');
  expect(pairs.questionToken).toBeDefined();
  expect(truncated.questionToken).toBeDefined();
  expect(pairs.type?.getText(source)).toBe('GscMetricRow[]');
  expect(truncated.type?.getText(source)).toBe('boolean');
});

it('adds only an optional semantic grouping language to the legacy crawled page contract', () => {
  const source = parse('crawl/page.ts');
  const page = source.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === 'CrawledPageSummary');
  if (!page || !ts.isInterfaceDeclaration(page)) throw new Error('Missing crawled page contract');
  const language = page.members.find(member => member.name?.getText(source) === 'semantic_language');
  if (!language || !ts.isPropertySignature(language)) throw new Error('Missing additive field');
  expect(language.questionToken).toBeDefined();
  expect(language.type?.getText(source)).toBe('string | null');
});

it('adds an optional formula version without breaking legacy crawl snapshots', () => {
  const source = parse('crawl/result.ts');
  const declaration = source.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === 'SiteCrawlResult');
  if (!declaration || !ts.isInterfaceDeclaration(declaration)) throw new Error('Missing crawl result contract');
  const version = declaration.members.find(member => member.name?.getText(source) === 'score_version');
  if (!version || !ts.isPropertySignature(version)) throw new Error('Missing formula version');
  expect(version.questionToken).toBeDefined();
  expect(version.type?.getText(source)).toBe('number');
});

it('keeps structured robots evidence optional for legacy crawl snapshots', () => {
  const source = parse('crawl/result.ts');
  const declaration = source.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === 'SiteCrawlResult');
  if (!declaration || !ts.isInterfaceDeclaration(declaration)) throw new Error('Missing crawl result contract');
  for (const name of ['robots_txt_evaluation_status', 'robots_txt_warning', 'robots_txt_status_code', 'robots_txt_final_url', 'robots_txt_redirect_chain']) {
    const field = declaration.members.find(member => member.name?.getText(source) === name);
    expect(field && ts.isPropertySignature(field) && field.questionToken, `${name} must remain optional`).toBeTruthy();
  }
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
