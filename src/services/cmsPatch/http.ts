import { CmsError, type CmsResponse, type CmsTarget, type CmsTransport } from './types';

export const CMS_TIMEOUT_MS = 15_000;

/** Sends one request; the URL must already be SSRF-checked. Maps stale-write statuses to `conflict`. */
export const call = async (send: CmsTransport, target: CmsTarget, method: 'GET' | 'POST' | 'PUT', url: string, extra: { body?: unknown; ifMatch?: string } = {}): Promise<CmsResponse> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (extra.body !== undefined) headers['Content-Type'] = 'application/json';
  if (extra.ifMatch) headers['If-Match'] = extra.ifMatch;
  const res = await send({ method, url, headers, credential: target.credential, followRedirects: false, timeoutMs: CMS_TIMEOUT_MS, ...(extra.body !== undefined ? { body: JSON.stringify(extra.body) } : {}) });
  if (res.status === 409 || res.status === 412) throw new CmsError('conflict', 'The page was edited since it was read', res.status);
  if (res.status < 200 || res.status >= 300) throw new CmsError('http', `CMS answered HTTP ${res.status}`, res.status);
  return res;
};

export const json = (res: CmsResponse): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(res.body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* falls through */ }
  throw new CmsError('bad-response', 'CMS returned a body that is not a JSON object');
};

export const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
export const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? value as Record<string, unknown> : {});
