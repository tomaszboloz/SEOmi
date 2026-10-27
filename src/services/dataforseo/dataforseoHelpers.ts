import { SearchIntent } from '@/types';
import { ResearchDomainError, normalizeResearchDomain } from '../../../mcp-server/src/contracts/researchDomain.js';
import i18n from '@/i18n';
import { DataForSeoRequestError, JsonRecord } from './dataforseoTypes';

export const asRecord = (value: unknown): JsonRecord => value && typeof value === 'object' ? value as JsonRecord : {};
export const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const number = (value: unknown): number => typeof value === 'number' ? value : Number(value) || 0;
export const nullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
export const text = (value: unknown): string => typeof value === 'string' ? value : '';
export const booleanish = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'dofollow'].includes(value.trim().toLowerCase());
  return false;
};

export const statusFromMessage = (message: string): number | null => {
  const match = message.match(/\bHTTP\s+(\d{3})\b/i);
  return match ? Number(match[1]) : null;
};

// A 429 can be a short-lived transport throttle or a hard account limit. Only
// the latter must fail closed without retrying a paid request.
export const providerQuotaMessage = (message: string): boolean => /quota|rate\s*limit|insufficient funds|balance|billing|account limit/i.test(message);

export const asRequestError = (error: unknown): DataForSeoRequestError => {
  if (error instanceof DataForSeoRequestError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const status = statusFromMessage(message);
  const quotaExceeded = providerQuotaMessage(message);
  // Native IPC errors carry the provider's HTTP status in their message. A
  // 429 caused by account quota/balance must fail closed just like the browser
  // transport path; retrying it would repeat a paid request without changing
  // the account state. Only an unqualified transport throttle is retryable.
  return new DataForSeoRequestError(message, status, status === 429 && !quotaExceeded, quotaExceeded);
};

export const retryDelayMs = (error: DataForSeoRequestError, attempt: number): number => {
  if (error.retryAfterSeconds !== null) return Math.max(0, Math.min(error.retryAfterSeconds * 1000, 10_000));
  return Math.min(2_000, 250 * 2 ** attempt);
};

export const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));

export const intent = (value: unknown): SearchIntent => {
  const normalized = text(value).toLowerCase();
  if (normalized.includes('transaction')) return 'Transactional';
  if (normalized.includes('commercial')) return 'Commercial';
  if (normalized.includes('informational')) return 'Informational';
  if (normalized.includes('navigational') || normalized.includes('navigation')) return 'Navigational';
  return 'Unknown';
};

export const nullableIntent = (value: unknown): SearchIntent | null => typeof value === 'string' && value.trim() ? intent(value) : null;

export const localizedDomainOperation = <T>(operation: () => T): T => {
  try { return operation(); }
  catch (error) {
    if (error instanceof ResearchDomainError) throw new Error(i18n.t(`runtimeErrors.dataforseo.${error.code}`), { cause: error });
    throw error;
  }
};

export const normalizeDataForSeoDomain = (value: string): string => localizedDomainOperation(() => normalizeResearchDomain(value));

export const displayLocale = (): string => (i18n.language || 'en').replace('_', '-');
