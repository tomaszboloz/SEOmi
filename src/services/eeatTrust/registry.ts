import type { ProfileEvidence, ProfileStatus } from './types';
import { hostMatches } from './identifiers';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';

export interface RegistryResponse { status: number; url: string; body: string; sourceDate?: string }
export interface RegistryFetcher { (url: string, signal: AbortSignal): Promise<RegistryResponse> }
export interface RegistryOptions {
  fetcher?: RegistryFetcher; now?: () => string; ttlMs?: number; maxBytes?: number; timeoutMs?: number; maxRequests?: number;
  matches?: (profile: ProfileEvidence, response: RegistryResponse) => boolean | undefined;
}
export interface RegistryResult { profile: ProfileEvidence; stale: boolean }

/** Production transport: all registry bytes come through the bounded native IPC command. */
export const nativeRegistryFetcher: RegistryFetcher = async (url) => {
  if (!isTauriEnvironment()) throw new Error('registry-native-only');
  const result = await invokeTauriCommand<{ status: number; final_url: string; body: string; source_date?: string }>('fetch_registry_profile', { url });
  return { status: result.status, url: result.final_url, body: result.body, sourceDate: result.source_date };
};

const LIMITS = { ttlMs: 86_400_000, maxBytes: 512_000, timeoutMs: 4_000, maxRequests: 8 };
const cache = new Map<string, { profile: ProfileEvidence; at: number }>();
const budgets = new WeakMap<object, number>();
const hosts: Record<string, string[]> = {
  orcid: ['orcid.org'], wikidata: ['wikidata.org'], register: ['scholar.google.com', 'researchgate.net', 'scopus.com'],
};

const privateHost = (host: string): boolean => {
  const value = host.toLowerCase().replace(/\.$/, '');
  if (value === 'localhost' || value.endsWith('.localhost') || value === '::1') return true;
  if (value.includes(':')) {
    if (value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')) return true;
    const mapped = value.match(/^(?:0*:)*ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mapped) return privateHost(mapped);
    return false;
  }
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 169 && parts[1] === 254);
};

export const safeRegistryUrl = (value: string, kind: ProfileEvidence['kind']): URL | undefined => {
  try {
    const url = new URL(value);
    const allowed = hosts[kind] ?? [];
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol !== 'https:' || privateHost(url.hostname) || !allowed.some((domain) => hostMatches(host, domain))) return undefined;
    return url;
  } catch { return undefined; }
};

const statusFor = (profile: ProfileEvidence, response: RegistryResponse, options: RegistryOptions): ProfileStatus => {
  if (response.status < 200 || response.status >= 300) return 'unavailable';
  const matches = options.matches?.(profile, response);
  return matches === true ? 'verified' : matches === false ? 'mismatch' : 'fetched';
};

export const verifyProfile = async (profile: ProfileEvidence, options: RegistryOptions = {}): Promise<RegistryResult> => {
  if (profile.status !== 'syntax-valid') return { profile, stale: false };
  const now = options.now ?? (() => new Date().toISOString());
  const nowMs = Date.parse(now()); const ttl = options.ttlMs ?? LIMITS.ttlMs;
  const cached = cache.get(profile.url);
  if (cached && nowMs - cached.at <= ttl) return { profile: cached.profile, stale: false };
  const url = safeRegistryUrl(profile.url, profile.kind);
  if (!url || !options.fetcher) return { profile: { ...profile, status: 'unavailable', detail: 'registry-unavailable' }, stale: Boolean(cached) };
  const used = budgets.get(options) ?? 0;
  if (used >= (options.maxRequests ?? LIMITS.maxRequests)) return { profile: { ...profile, status: 'unavailable', detail: 'rate-budget' }, stale: Boolean(cached) };
  budgets.set(options, used + 1);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? LIMITS.timeoutMs);
  try {
    const response = await options.fetcher(url.toString(), controller.signal);
    if (!safeRegistryUrl(response.url, profile.kind)) return { profile: { ...profile, status: 'unavailable', detail: 'unsafe-redirect' }, stale: false };
    if (response.body.length > (options.maxBytes ?? LIMITS.maxBytes)) return { profile: { ...profile, status: 'unavailable', detail: 'body-limit' }, stale: false };
    const result = { ...profile, status: statusFor(profile, response, options), fetchedAt: now(), expiresAt: new Date(nowMs + ttl).toISOString(), sourceDate: response.sourceDate };
    cache.set(profile.url, { profile: result, at: nowMs });
    return { profile: result, stale: false };
  } catch { return { profile: { ...profile, status: 'unavailable', detail: 'transport-error' }, stale: Boolean(cached) }; }
  finally { clearTimeout(timeout); }
};

export const clearRegistryCache = (): void => { cache.clear(); };
