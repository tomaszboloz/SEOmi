export interface CreateDraftOptions {
  apiUrl?: string;
  repository: string;
  tag: string;
  commitSha: string;
  candidateVersion?: string;
  name?: string;
  body?: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export interface PublishDraftOptions {
  apiUrl?: string;
  repository: string;
  releaseId: number;
  expectedSha: string;
  candidateVersion: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export declare function createOrGetDraftRelease(options: CreateDraftOptions): Promise<number>;
export declare function verifyAndPublishDraftRelease(options: PublishDraftOptions): Promise<Record<string, unknown>>;
