export interface ResolveTagOptions {
  refType?: string;
  refName?: string;
  packageVersion: string;
  tagExistsRemote?: boolean;
}

export interface TagRemoteOptions {
  apiUrl?: string;
  repository: string;
  tag: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export interface VerifyTagCommitOptions {
  apiUrl?: string;
  repository: string;
  tag: string;
  expectedSha: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export interface ValidateTagOptions {
  refType?: string;
  refName?: string;
  packageVersion: string;
  expectedSha: string;
  repository: string;
  token: string;
  apiUrl?: string;
  fetchImpl?: typeof fetch;
  tagExistsRemote?: boolean;
}

export declare function resolveExpectedTag(packageJsonPath?: string): string;
export declare function resolveReleaseTag(options: ResolveTagOptions): { tag: string; publish: boolean };
export declare function checkTagExistsRemote(options: TagRemoteOptions): Promise<boolean>;
export declare function verifyTagTargetCommit(options: VerifyTagCommitOptions): Promise<{ tag: string; commitSha: string; objectType?: string }>;
export declare function ensureTagRefTarget(options: VerifyTagCommitOptions): Promise<{ tag: string; commitSha: string; created?: boolean }>;
export declare function validateReleaseGateTag(options: ValidateTagOptions): Promise<{ tag: string; publish: boolean }>;
export declare function runReleaseGateTagCli(
  env?: NodeJS.ProcessEnv,
  args?: string[],
  fetchImpl?: typeof fetch,
  packageJsonPath?: string,
): Promise<unknown>;
