export interface FocusPdfManifest {
  issue: 53;
  commit: string;
  renderer: string;
  verdict: 'PENDING-HUMAN-REVIEW';
  files: Array<{ pdf: string; sha256: string; pngs: string[] }>;
}
type Run = (command: string, args: string[], options?: unknown) => unknown;
type ReadDir = (dir: string) => string[];
type ReadFile = (file: string) => Uint8Array | string;
export declare function sha256(bytes: Uint8Array | string): string;
export declare function listPdfs(dir: string, readDir?: ReadDir): string[];
export declare function buildManifest(input: { dir: string; commit: string; renderer: string; files: string[]; readFile?: ReadFile; rendered?: Record<string, string[]> }): FocusPdfManifest;
export declare function rasterise(dir: string, name: string, run?: Run, readDir?: ReadDir): string[];
export declare function main(argv: string[], deps?: { run?: Run; readDir?: ReadDir; readFile?: ReadFile; write?: (file: string, text: string) => void; log?: (line: string) => void }): number;
