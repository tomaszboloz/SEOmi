import type ts from 'typescript';
export interface InventoryEntry {
  file: string; name: string; kind: string; line: number;
  functionRange: { start: {line: number;column: number};bodyStart?: {line: number;column: number};bodyEnd?: {line: number;column: number};end: {line: number;column: number} } | null;
  exports: Array<{file: string; name: string}>; testReferences: string[];
}
export function sourceFiles(directory: string): string[];
export function sourceHashes(files: string[]): Record<string,string>;
export function executionEvidence(entry: InventoryEntry, coverage: Record<string,unknown>, manifest: Record<string,string> | null, currentHash: string): {status: string;calls: number | null};
export function inventoryProgram(program: ts.Program, productionFiles: Set<string>, testFiles: string[]): InventoryEntry[];
export function createInventory(): unknown;

export function sourceAwareCompilerHost(options: ts.CompilerOptions, sourceManifest: Record<string,string> | null, runtimeManifest: Record<string,string> | null): ts.CompilerHost;
