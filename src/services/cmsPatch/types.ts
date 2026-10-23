export type CmsKind = 'wordpress' | 'strapi' | 'webhook';

/** Where a page lives. `credential` is a NAME in the OS credential store; the secret never enters JS or logs. */
export interface CmsTarget {
  kind: CmsKind;
  baseUrl: string;
  contentId: string;
  credential: string;
  /** Strapi collection (default `articles`). */
  collection?: string;
}

export interface CmsRequest {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  headers: Record<string, string>;
  body?: string;
  /** Name of the stored credential; the transport attaches the auth header natively. */
  credential: string;
  /** Redirects must never be followed: a redirect could leave the validated host. */
  followRedirects: false;
  timeoutMs: number;
}

export interface CmsResponse { status: number; headers: Record<string, string>; body: string }
export type CmsTransport = (request: CmsRequest) => Promise<CmsResponse>;

export interface CmsDocument { content: string; title?: string; revision: string }

export interface CmsAdapter {
  read(target: CmsTarget, send: CmsTransport): Promise<CmsDocument>;
  /** `baseRevision` is sent as If-Match; the server (or the pre-write recheck) rejects a stale write. */
  write(target: CmsTarget, content: string, baseRevision: string, send: CmsTransport): Promise<{ revision: string }>;
}

export type CmsErrorCode = 'unsafe-url' | 'conflict' | 'http' | 'bad-response' | 'heading-not-found' | 'heading-ambiguous' | 'forbidden' | 'not-approved' | 'fact-gate-required';

export class CmsError extends Error {
  constructor(readonly code: CmsErrorCode, message: string, readonly status?: number) {
    super(message);
    this.name = 'CmsError';
  }
}
