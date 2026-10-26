export declare function macManifestFileNames(platform: string, version: string): string[];
export declare function macLocalBundleFileNames(platform: string, version: string): string[];
export declare function selectSignedMacBundle(options: { files: string[]; sigFiles: string[]; platform: string; version: string }): { bundlePath: string; sigPath: string } | null;
export declare function remoteMacAssetName(localPath: string, platform: string, version: string): string;
