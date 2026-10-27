export declare const MANIFEST_PLATFORMS: readonly string[];
export declare function expectedManifestFileNames(platform: string, version: string): string[];
export declare function expectedManifestFileName(platform: string, version: string): string;
export declare function validateManifestFragment(fragment: unknown, options: { version: string; repository?: string }): { platform: string; entry: { signature: string; url: string } };
export declare function manifestRepository(fragment: { entry: { url: string } }): string;
