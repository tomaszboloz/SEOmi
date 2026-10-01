export function mapRuntimeCoverage(processCoverage: {result: unknown[]}, runtimeFiles: string[], expectedSources: Record<string,string>, expectedRuntime: Record<string,string>): Promise<Record<string,unknown>>;
export function runMcpCoverage(): Promise<void>;
