import { readResponseTextLimited } from './httpSafety.js';
import type { JsonObject } from './responseOutput.js';

export const MAX_PROVIDER_BYTES = 2 * 1024 * 1024;

export interface ProviderDependencies {
  fetch?: typeof globalThis.fetch;
  env?: Record<string, string | undefined>;
}

export const readProviderJson = async (response: Response, maxBytes = MAX_PROVIDER_BYTES): Promise<JsonObject> => {
  const body = await readResponseTextLimited(response, maxBytes);
  if (body.truncated) throw new Error('Provider response exceeds the size limit.');
  let parsed: unknown;
  try { parsed = JSON.parse(body.text); } catch { throw new Error('Provider response must be a valid JSON object.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Provider response must be a JSON object.');
  return parsed as JsonObject;
};

/** Fixed provider endpoints use bounded decoded reads and forbid redirects.
 * Credentials are read at invocation time; injected transports never need
 * paid accounts and tests can inspect the actual outgoing request contract. */
export const createProviderClient = (dependencies: ProviderDependencies = {}) => {
  const request = dependencies.fetch ?? globalThis.fetch;
  const env = dependencies.env ?? process.env;
  const dataForSeo = async (path: string, payload: JsonObject[]): Promise<JsonObject> => {
    const login = env.DATAFORSEO_LOGIN;
    const password = env.DATAFORSEO_PASSWORD;
    if (!login || !password) throw new Error('Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD before calling DataForSEO tools.');
    const response = await request(`https://api.dataforseo.com${path}`, {
      method: 'POST', redirect: 'error',
      headers: { authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`DataForSEO HTTP ${response.status}.`); }
    const body = await readProviderJson(response);
    const task: unknown = Array.isArray(body.tasks) ? body.tasks[0] : undefined;
    if (!task || typeof task !== 'object' || Array.isArray(task)) throw new Error('DataForSEO returned an invalid task.');
    const record = task as JsonObject;
    if (record.status_code !== 20000) throw new Error(`DataForSEO task failed (${typeof record.status_code === 'number' ? record.status_code : 'unknown'}).`);
    return record;
  };
  const googleApiKey = (): string => {
    const key = env.GOOGLE_API_KEY?.trim() || env.GOOGLE_PAGESPEED_API_KEY?.trim();
    if (!key) throw new Error('Set GOOGLE_API_KEY before calling Google performance MCP tools.');
    if (key.length > 256 || /[\r\n]/.test(key)) throw new Error('GOOGLE_API_KEY is invalid.');
    return key;
  };
  const googleJson = async (url: string, init: RequestInit): Promise<JsonObject> => {
    const token = env.GOOGLE_ACCESS_TOKEN?.trim();
    if (!token) throw new Error('Set GOOGLE_ACCESS_TOKEN before calling Search Console MCP tools.');
    const response = await request(url, {
      ...init, redirect: 'error',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Google Search Console HTTP ${response.status}.`); }
    return readProviderJson(response);
  };
  const googlePublicJson = async (url: string, init: RequestInit = {}): Promise<JsonObject> => {
    const response = await request(url, {
      ...init, redirect: 'error', headers: { 'content-type': 'application/json', ...(init.headers || {}) },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Google performance HTTP ${response.status}.`); }
    return readProviderJson(response);
  };
  return { dataForSeo, googleJson, googlePublicJson, googleApiKey };
};
