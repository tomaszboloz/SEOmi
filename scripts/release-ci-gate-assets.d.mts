export const REQUIRED_PLATFORMS: readonly string[];

export interface ReleaseAsset {
  id: number;
  name: string;
  size?: number;
  state?: string;
  browser_download_url?: string;
}

export interface ReleasePayload {
  id: number;
  tag_name: string;
  draft?: boolean;
  target_commitish?: string;
  assets?: ReleaseAsset[];
}

export function validateReleaseAssetsAndPlatforms(
  release: ReleasePayload,
  latestJsonContent: string | object,
  candidateVersion?: string,
  repository?: string,
): { valid: boolean; platforms: string[] };

export function createOrGetDraftRelease(options: {
  apiUrl?: string;
  repository: string;
  tag: string;
  commitSha: string;
  candidateVersion?: string;
  name?: string;
  body?: string;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<number>;

export function verifyAndPublishDraftRelease(options: {
  apiUrl?: string;
  repository: string;
  releaseId: number | string;
  expectedSha: string;
  candidateVersion?: string;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<ReleasePayload>;
