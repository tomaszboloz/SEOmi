export declare function validateReleaseVersion(value: unknown): string;
export declare function validateReleaseTag(value: unknown): string;
export declare function validateRepository(value: unknown): string;
export declare function validateGithubApiBase(value: unknown, upload?: boolean): string;
export declare function validateReleaseId(value: unknown): number;
export declare function writeGithubOutput(key: string, value: unknown, outputPath?: string): void;
export declare function validateGitHubReleaseContext(value: { apiUrl?: unknown; uploadUrl?: unknown; repository: unknown; releaseId: unknown }): { apiUrl: string; uploadUrl: string; repository: string; releaseId: number };
