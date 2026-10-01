import ts from 'typescript';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative, join, dirname } from 'node:path';
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
    let declaration = explicitDeclaration || declarations.find(node => ts.isFunctionDeclaration(node) && node.body) || declarations.find(node => !node.getSourceFile().isDeclarationFile);
    if (!declaration) return;
    // Identifier aliases refer to the original body. A factory invocation does
    // not: executing the factory is not evidence that its returned hook ran.
    const aliasSymbols = [symbol];
    const visited = new Set([symbol]);
    while (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      let initializer = declaration.initializer;
      while (ts.isParenthesizedExpression(initializer)) initializer = initializer.expression;
      if (!ts.isIdentifier(initializer)) break;
      const target = canonical(checker.getSymbolAtLocation(initializer));
      if (!target || visited.has(target)) break;
      const targetDeclarations = target.getDeclarations() || [];
      const targetDeclaration = targetDeclarations.find(node => ts.isFunctionDeclaration(node) && node.body) || targetDeclarations.find(node => !node.getSourceFile().isDeclarationFile);
      if (!targetDeclaration) break;
      visited.add(target);
      aliasSymbols.push(target);
      declaration = targetDeclaration;
    }
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
    for (const alias of aliasSymbols) symbolRows.set(alias, row);
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

/** Resolve calls into compiled MCP modules only when emitted/source bytes are fresh. */
export function sourceAwareCompilerHost(options, sourceManifest, runtimeManifest) {
  const host = ts.createCompilerHost(options);
  host.resolveModuleNames = (names, containingFile) => names.map(name => {
    const resolved = ts.resolveModuleName(name, containingFile, options, host).resolvedModule;
    if (!resolved || !normalize(resolved.resolvedFileName).startsWith('mcp-server/dist/') || !resolved.resolvedFileName.endsWith('.js')) return resolved;
    const runtime = normalize(resolved.resolvedFileName);
    const mapFile = `${runtime}.map`;
    if (!runtimeManifest?.[runtime] || !runtimeManifest?.[mapFile]) return resolved;
    if (!existsSync(mapFile)) return resolved;
    const hashes = sourceHashes([runtime, mapFile]);
    if (hashes[runtime] !== runtimeManifest[runtime] || hashes[mapFile] !== runtimeManifest[mapFile]) return resolved;
    try {
      const map = JSON.parse(readFileSync(mapFile, 'utf8'));
      if (map.sources?.length !== 1 || map.sourcesContent?.length !== 1) return resolved;
      const original = resolve(dirname(resolve(runtime)), map.sourceRoot || '', map.sources[0]);
      const file = normalize(original);
      if (!sourceManifest?.[file] || !file.startsWith('mcp-server/src/') || !existsSync(original)) return resolved;
      if (sourceHashes([original])[file] !== sourceManifest[file] || readFileSync(original, 'utf8') !== map.sourcesContent[0]) return resolved;
      return {...resolved, resolvedFileName:original, extension:ts.Extension.Ts};
    } catch { return resolved; }
  });
  return host;
}

export function createInventory() {
  const production = [...sourceFiles('src'), ...sourceFiles('mcp-server/src')].filter(file => !file.endsWith('.mjs'));
  const tests = [...sourceFiles('tests'), ...sourceFiles('mcp-server/test')];
  const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
  const mcpSourceManifest = existsSync('test-results/mcp-coverage-sources.json') ? JSON.parse(readFileSync('test-results/mcp-coverage-sources.json', 'utf8')) : null;
  const mcpRuntimeManifest = existsSync('test-results/mcp-runtime-sources.json') ? JSON.parse(readFileSync('test-results/mcp-runtime-sources.json', 'utf8')) : null;
  const options = { ...config.options, allowJs:true, checkJs:false };
  const program = ts.createProgram([...production, ...tests].map(file => resolve(file)), options, sourceAwareCompilerHost(options, mcpSourceManifest, mcpRuntimeManifest));
  const hashes = sourceHashes(production);
  const coverage = existsSync('coverage/coverage-final.json') ? JSON.parse(readFileSync('coverage/coverage-final.json', 'utf8')) : {};
  const manifest = existsSync('test-results/frontend-coverage-sources.json') ? JSON.parse(readFileSync('test-results/frontend-coverage-sources.json', 'utf8')) : null;
  const mcpCoverage = existsSync('coverage/mcp-coverage-final.json') ? JSON.parse(readFileSync('coverage/mcp-coverage-final.json', 'utf8')) : {};
  const mcpManifest = existsSync('test-results/mcp-coverage-sources.json') ? JSON.parse(readFileSync('test-results/mcp-coverage-sources.json', 'utf8')) : null;
  let mcpRuntimeFresh = false;
  try { mcpRuntimeFresh = mcpRuntimeManifest && Object.keys(mcpRuntimeManifest).length > 0 && JSON.stringify(sourceHashes(Object.keys(mcpRuntimeManifest))) === JSON.stringify(mcpRuntimeManifest); } catch { /* Missing emitted files invalidate the measured runtime. */ }
  const functions = inventoryProgram(program, new Set(production.map(file => resolve(file))), tests.map(file => resolve(file)));
  for (const entry of functions) {
    const nativeNodeEvidence = entry.file.startsWith('mcp-server/') && mcpManifest?.[entry.file];
    entry.execution = nativeNodeEvidence && !mcpRuntimeFresh ? {status:'stale-runtime',calls:null} : executionEvidence(entry, nativeNodeEvidence ? mcpCoverage : coverage, nativeNodeEvidence ? mcpManifest : manifest, hashes[entry.file]);
    entry.execution.provider = nativeNodeEvidence ? 'node-mcp-v8' : 'vitest-v8';
  }
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
