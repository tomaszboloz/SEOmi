export function productionCoverage(raw: string, sources: Record<string, { sha256: string; production_reachable: boolean; test_reachable: boolean; test_ranges: number[][] }>, readSource?: (file: string) => Uint8Array, llvmJson?: unknown): {
  lcov: string;
  summary: { totals: Record<string, number>; excludedFiles: { file: string; reason: string }[]; scope: string };
};
