import ts from 'typescript';
import { resolve } from 'node:path';
import { normalize, position } from './inventory-utils.mjs';

function resolveTargetDeclaration(declaration, checker, canonical) {
  let current = declaration;
  const aliasSymbols = [];
  const visited = new Set();
  while (ts.isVariableDeclaration(current) && current.initializer) {
    let initializer = current.initializer;
    while (ts.isParenthesizedExpression(initializer)) initializer = initializer.expression;
    if (!ts.isIdentifier(initializer)) break;
    const target = canonical(checker.getSymbolAtLocation(initializer));
    if (!target || visited.has(target)) break;
    const decls = target.getDeclarations() || [];
    const targetDecl = decls.find(node => ts.isFunctionDeclaration(node) && node.body) || decls.find(node => !node.getSourceFile().isDeclarationFile);
    if (!targetDecl) break;
    visited.add(target);
    aliasSymbols.push(target);
    current = targetDecl;
  }
  return { declaration: current, aliasSymbols };
}

function extractFunctionRange(callable, source) {
  const node = callable && (ts.isFunctionDeclaration(callable) || ts.isArrowFunction(callable) || ts.isFunctionExpression(callable) || ts.isMethodDeclaration(callable) || ts.isConstructorDeclaration(callable) || ts.isGetAccessorDeclaration(callable) || ts.isSetAccessorDeclaration(callable)) ? callable : null;
  let body = node?.body;
  while (body && ts.isParenthesizedExpression(body)) body = body.expression;
  return node ? {
    start: position(source, node.getStart(source)),
    bodyStart: body ? position(source, body.getStart(source)) : undefined,
    bodyEnd: body ? position(source, body.getEnd()) : undefined,
    end: position(source, node.getEnd())
  } : null;
}

export function inventoryProgram(program, productionFiles, testFiles) {
  const checker = program.getTypeChecker();
  const rows = new Map();
  const symbolRows = new Map();
  const canonical = symbol => symbol && (symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol);

  const add = (symbol, name, exportedFrom, kind = 'function', explicitDeclaration) => {
    symbol = canonical(symbol);
    if (!symbol) return;
    const decls = symbol.getDeclarations() || [];
    let declaration = explicitDeclaration || decls.find(node => ts.isFunctionDeclaration(node) && node.body) || decls.find(node => !node.getSourceFile().isDeclarationFile);
    if (!declaration) return;
    const resolved = resolveTargetDeclaration(declaration, checker, canonical);
    declaration = resolved.declaration;
    const aliasSymbols = [symbol, ...resolved.aliasSymbols];
    let callable = declaration;
    if (ts.isVariableDeclaration(declaration) || ts.isPropertyDeclaration(declaration)) callable = declaration.initializer;
    const source = declaration.getSourceFile();
    const file = normalize(source.fileName);
    if (!productionFiles.has(resolve(source.fileName))) return;
    const key = `${file}:${declaration.getStart(source)}`;
    if (!rows.has(key)) rows.set(key, {
      file, name: ts.isConstructorDeclaration(declaration) ? 'constructor' : symbol.getName(), kind,
      line: position(source, declaration.getStart(source)).line,
      functionRange: extractFunctionRange(callable, source),
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
        const declarationRow = decl => decl && rows.get(`${normalize(decl.getSourceFile().fileName)}:${decl.getStart(decl.getSourceFile())}`);
        const row = declarationRow(resolved) || symbolRows.get(symbol) || symbol?.getDeclarations()?.map(declarationRow).find(Boolean);
        if (row && !row.testReferences.includes(normalize(file))) row.testReferences.push(normalize(file));
      }
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const symbol = canonical(checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression));
        const write = ts.isBinaryExpression(node.parent) && node.parent.left === node && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
        for (const decl of symbol?.getDeclarations() || []) {
          if (!(write ? ts.isSetAccessorDeclaration(decl) : ts.isGetAccessorDeclaration(decl))) continue;
          const row = rows.get(`${normalize(decl.getSourceFile().fileName)}:${decl.getStart(decl.getSourceFile())}`);
          if (row && !row.testReferences.includes(normalize(file))) row.testReferences.push(normalize(file));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...rows.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}
