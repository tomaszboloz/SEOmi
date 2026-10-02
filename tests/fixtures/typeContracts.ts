import ts from 'typescript';
import { createHash } from 'node:crypto';

export function exportedTypeContract(path: string) {
  const program = ts.createProgram([path], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const file = program.getSourceFile(path);
  if (!file) throw new Error(`Missing type contract: ${path}`);
  const module = checker.getSymbolAtLocation(file);
  if (!module) throw new Error(`Missing type module: ${path}`);
  const printer = ts.createPrinter({ removeComments: true });
  const declarations = checker.getExportsOfModule(module).map(symbol => {
    const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const signatures = (resolved.declarations || []).map(declaration =>
      printer.printNode(ts.EmitHint.Unspecified, declaration, declaration.getSourceFile()));
    return { name: symbol.name, signatures };
  }).sort((left, right) => left.name.localeCompare(right.name));
  return {
    exports: declarations.length,
    sha256: createHash('sha256').update(JSON.stringify(declarations)).digest('hex'),
  };
}
