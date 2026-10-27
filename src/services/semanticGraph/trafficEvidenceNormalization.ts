import type { GscPerformanceFilters } from '@/types';
import { normalizeGraphUrl } from './urls';

export interface TrafficPropertyScope {
  kind: 'domain' | 'prefix';
  host: string;
  protocol?: 'http:' | 'https:';
  port?: string;
  prefix?: string;
  key: string;
}

export interface TrafficDateRange { startDate: string; endDate: string; }

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEARCH_TYPES = new Set(['web', 'image', 'video', 'news', 'discover', 'googleNews']);
const DEVICES = new Set(['DESKTOP', 'MOBILE', 'TABLET']);

const host = (value: string): string => value.toLocaleLowerCase().replace(/\.$/, '');

export const normalizeTrafficUrl = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const parsed = new URL(normalizeGraphUrl(value));
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    parsed.hostname = host(parsed.hostname);
    parsed.hash = '';
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString();
  } catch { return ''; }
};

export const normalizeTrafficProperty = (value: unknown): TrafficPropertyScope | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  if (raw.toLocaleLowerCase().startsWith('sc-domain:')) {
    const domain = host(raw.slice(raw.indexOf(':') + 1).trim());
    if (!domain || domain.includes('/') || domain.includes(':')) return null;
    return { kind: 'domain', host: domain, key: `sc-domain:${domain}` };
  }
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    const prefix = parsed.pathname.replace(/\/+$/, '') || '/';
    const normalizedPort = parsed.port ? `:${parsed.port}` : '';
    const normalized = `${parsed.protocol}//${host(parsed.hostname)}${normalizedPort}${prefix === '/' ? '/' : `${prefix}/`}`;
    return { kind: 'prefix', host: host(parsed.hostname), protocol: parsed.protocol as 'http:' | 'https:', port: parsed.port, prefix, key: normalized };
  } catch { return null; }
};

export const trafficPropertyMatchesUrl = (scope: TrafficPropertyScope, value: string): boolean => {
  try {
    const parsed = new URL(value);
    const pageHost = host(parsed.hostname);
    if (scope.kind === 'domain') return pageHost === scope.host || pageHost.endsWith(`.${scope.host}`);
    if (pageHost !== scope.host || parsed.protocol !== scope.protocol || parsed.port !== (scope.port ?? '')) return false;
    const path = parsed.pathname || '/';
    return scope.prefix === '/' || path === scope.prefix || path.startsWith(`${scope.prefix}/`);
  } catch { return false; }
};

export const normalizeTrafficDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !DATE.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
};

export const normalizeTrafficDateRange = (start: unknown, end: unknown): TrafficDateRange | null => {
  const startDate = normalizeTrafficDate(start);
  const endDate = normalizeTrafficDate(end);
  return startDate && endDate && startDate <= endDate ? { startDate, endDate } : null;
};

export const normalizeTrafficFilters = (value: unknown): GscPerformanceFilters | null => {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const result: GscPerformanceFilters = {};
  if (raw.search_type !== undefined) {
    if (typeof raw.search_type !== 'string' || !SEARCH_TYPES.has(raw.search_type)) return null;
    result.search_type = raw.search_type as GscPerformanceFilters['search_type'];
  }
  if (raw.device !== undefined) {
    if (typeof raw.device !== 'string' || !DEVICES.has(raw.device.toLocaleUpperCase())) return null;
    result.device = raw.device.toLocaleUpperCase() as GscPerformanceFilters['device'];
  }
  if (raw.country !== undefined) {
    if (typeof raw.country !== 'string' || !/^[a-z]{3}$/i.test(raw.country.trim())) return null;
    result.country = raw.country.trim().toLocaleLowerCase();
  }
  return result;
};

export const sameTrafficFilters = (left: GscPerformanceFilters, right: GscPerformanceFilters): boolean =>
  ['search_type', 'device', 'country'].every((key) => left[key as keyof GscPerformanceFilters] === right[key as keyof GscPerformanceFilters]);

export const normalizeTrafficMetric = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
