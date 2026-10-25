export interface ExtractOptions {
  platform: string;
  targetDir?: string;
  repository: string;
  tag: string;
}

export interface ConsolidateOptions {
  manifestDir?: string;
  candidateVersion: string;
  repository?: string;
  releaseId?: number;
  token?: string;
  apiUrl?: string;
  fetchImpl?: typeof fetch;
}

export declare const PLATFORM_KEY_MAP: Record<string, string>;
export declare function computeRemoteAssetName(localPath: string, platformKey: string): string;
export declare function findFiles(dir: string): string[];
export declare function extractPlatformFragment(options: ExtractOptions): { platform: string; entry: { signature: string; url: string } };
export declare function consolidateManifests(options: ConsolidateOptions): Promise<Record<string, unknown>>;
export declare function runManifestCli(env?: NodeJS.ProcessEnv, args?: string[]): Promise<unknown>;
