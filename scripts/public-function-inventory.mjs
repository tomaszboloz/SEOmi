import ts from 'typescript';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(?:ts|tsx|mjs)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  }).sort();
}

export function sourceHashes(files) {
  return Object.fromEntries(files.map(file => [relative(process.cwd(), resolve(file)).replaceAll('\\', '/'), createHash('sha256').update(readFileSync(file)).digest('hex')]));
}

const normalize = file => relative(process.cwd(), resolve(file)).replaceAll('\\', '/');
const position = (source, offset) => {
  const result = source.getLineAndCharacterOfPosition(offset);
  return { line: result.line + 1, column: result.character };
};
const compare = (left, right) => left.line - right.line || left.column - right.column;

export function executionEvidence(entry, coverage, manifest, currentHash) {
  if (!manifest || manifest[entry.file] !== currentHash) return { status: manifest?.[entry.file] ? 'stale' : 'unavailable', calls: null };
  if (!entry.functionRange) return { status: 'factory-returned', calls: null };
  const record = Object.values(coverage || {}).find(value => normalize(value.path) === entry.file);
  if (!record) return { status: 'unavailable', calls: null };
  const matches = Object.entries(record.fnMap).filter(([, fn]) =>
    compare(fn.decl.start, entry.functionRange.start) >= 0 &&
    compare(fn.decl.start, entry.functionRange.bodyStart || entry.functionRange.end) < 0 &&
    fn.loc.end.line === (entry.functionRange.bodyEnd || entry.functionRange.end).line &&
    // V8 uses an unbounded end column, serialized as null by its JSON reporter.
    (fn.loc.end.column === null || fn.loc.end.column === (entry.functionRange.bodyEnd || entry.functionRange.end).column));
  if (matches.length !== 1) return { status: matches.length ? 'ambiguous' : 'unmapped', calls: null };
  const calls = record.f[matches[0][0]];
  if (!Number.isSafeInteger(calls) || calls < 0) return { status: 'invalid-count', calls: null };
  return { status: calls > 0 ? 'executed-under-suite' : 'not-executed', calls };
}

export function inventoryProgram(program, productionFiles, testFiles) {
  const checker = program.getTypeChecker();
  const rows = new Map();
  const symbolRows = new Map();
  const canonical = symbol => symbol && (symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol);
  const add = (symbol, name, exportedFrom, kind = 'function', explicitDeclaration) => {
    symbol = canonical(symbol);
    if (!symbol) return;
    const declarations = symbol.getDeclarations() || [];
    const declaration = explicitDeclaration || declarations.find(node => ts.isFunctionDeclaration(node) && node.body) || declarations.find(node => !node.getSourceFile().isDeclarationFile);
    if (!declaration) return;
    let callable = declaration;
    if (ts.isVariableDeclaration(declaration) || ts.isPropertyDeclaration(declaration)) callable = declaration.initializer;
    const functionNode = callable && (ts.isFunctionDeclaration(callable) || ts.isArrowFunction(callable) || ts.isFunctionExpression(callable) || ts.isMethodDeclaration(callable) || ts.isConstructorDeclaration(callable) || ts.isGetAccessorDeclaration(callable) || ts.isSetAccessorDeclaration(callable)) ? callable : null;
    let body = functionNode?.body;
    while (body && ts.isParenthesizedExpression(body)) body = body.expression;
    const source = declaration.getSourceFile();
    const file = normalize(source.fileName);
    if (!productionFiles.has(resolve(source.fileName))) return;
    const key = `${file}:${declaration.getStart(source)}`;
    if (!rows.has(key)) rows.set(key, {
      file, name: ts.isConstructorDeclaration(declaration) ? 'constructor' : symbol.getName(), kind,
      line: position(source, declaration.getStart(source)).line,
      functionRange: functionNode ? { start: position(source, functionNode.getStart(source)), bodyStart: body ? position(source, body.getStart(source)) : undefined, bodyEnd: body ? position(source, body.getEnd()) : undefined, end: position(source, functionNode.getEnd()) } : null,
      exports: [], testReferences: [],
    });
    const row = rows.get(key);
    if (!row.exports.some(value => value.file === normalize(exportedFrom) && value.name === name)) row.exports.push({ file: normalize(exportedFrom), name });
    symbolRows.set(symbol, row);
  };
  for (const file of productionFiles) {
    const source = program.getSourceFile(file);
    if (!source || source.isDeclarationFile) continue;
    const module = checker.getSymbolAtLocation(source);
    if (!module) continue;
    for (const exported of checker.getExportsOfModule(module)) {
      const symbol = canonical(exported);
      const declaration = symbol?.valueDeclaration || symbol?.getDeclarations()?.[0];
      if (!declaration) continue;
      const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
      if (type.getCallSignatures().length) add(symbol, exported.getName(), file);
      if (ts.isClassDeclaration(declaration)) {
        for (const member of declaration.members) {
          const modifiers = ts.canHaveModifiers(member) ? ts.getModifiers(member) || [] : [];
          if (modifiers.some(value => value.kind === ts.SyntaxKind.PrivateKeyword || value.kind === ts.SyntaxKind.ProtectedKeyword) || (member.name && ts.isPrivateIdentifier(member.name))) continue;
          if (ts.isConstructorDeclaration(member) && member.body) add(symbol, `${exported.getName()}.constructor`, file, 'constructor', member);
          if (member.name && (((ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) && member.body) || (ts.isPropertyDeclaration(member) && member.initializer && checker.getTypeAtLocation(member).getCallSignatures().length))) add(checker.getSymbolAtLocation(member.name), `${exported.getName()}.${member.name.getText(declaration.getSourceFile())}`, file, ts.isGetAccessorDeclaration(member) ? 'getter' : ts.isSetAccessorDeclaration(member) ? 'setter' : 'class-member', member);
        }
      }
    }
  }
  for (const file of testFiles) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    const visit = node => {
      const target = ts.isCallExpression(node) || ts.isNewExpression(node) ? node.expression : ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node.tagName : null;
      if (target) {
        const symbol = canonical(checker.getSymbolAtLocation(target));
        const resolved = ts.isCallExpression(node) || ts.isNewExpression(node) ? checker.getResolvedSignature(node)?.declaration : null;
        const declarationRow = declaration => declaration && rows.get(`${normalize(declaration.getSourceFile().fileName)}:${declaration.getStart(declaration.getSourceFile())}`);
        const row = declarationRow(resolved) || symbolRows.get(symbol) || symbol?.getDeclarations()?.map(declarationRow).find(Boolean);
        if (row && !row.testReferences.includes(normalize(file))) row.testReferences.push(normalize(file));
      }
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const symbol = canonical(checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression));
        const write = ts.isBinaryExpression(node.parent) && node.parent.left === node && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
        for (const declaration of symbol?.getDeclarations() || []) {
          if (!(write ? ts.isSetAccessorDeclaration(declaration) : ts.isGetAccessorDeclaration(declaration))) continue;
          const row = rows.get(`${normalize(declaration.getSourceFile().fileName)}:${declaration.getStart(declaration.getSourceFile())}`);
          if (row && !row.testReferences.includes(normalize(file))) row.testReferences.push(normalize(file));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...rows.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

export function createInventory() {
  const production = [...sourceFiles('src'), ...sourceFiles('mcp-server/src')].filter(file => !file.endsWith('.mjs'));
  const tests = [...sourceFiles('tests'), ...sourceFiles('mcp-server/test')];
  const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
  const program = ts.createProgram([...production, ...tests].map(file => resolve(file)), { ...config.options, allowJs: true, checkJs: false });
  const hashes = sourceHashes(production);
  const coverage = existsSync('coverage/coverage-final.json') ? JSON.parse(readFileSync('coverage/coverage-final.json', 'utf8')) : {};
  const manifest = existsSync('test-results/frontend-coverage-sources.json') ? JSON.parse(readFileSync('test-results/frontend-coverage-sources.json', 'utf8')) : null;
  const functions = inventoryProgram(program, new Set(production.map(file => resolve(file))), tests.map(file => resolve(file)));
  for (const entry of functions) entry.execution = executionEvidence(entry, coverage, manifest, hashes[entry.file]);
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  return {
    generatedAt: new Date().toISOString(), commit: head.status === 0 ? head.stdout.trim() : null,
    scope: 'TypeScript exported callables, declared public constructors, methods, accessors and callable properties; AST call/read/write references are not assertion proof. Positive coverage counts prove execution under the suite only. Implicit constructors and generated callables have no invented function body.',
    sourceHashes: hashes, functions,
    counts: Object.fromEntries([...new Set(functions.map(entry => entry.execution.status))].map(status => [status, functions.filter(entry => entry.execution.status === status).length])),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = createInventory();
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/public-function-inventory.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ functions: report.functions.length, counts: report.counts }));
  if (process.argv.includes('--require-tested') && report.functions.some(entry => entry.execution.status !== 'executed-under-suite' || !entry.testReferences.length)) process.exitCode = 1;
}
