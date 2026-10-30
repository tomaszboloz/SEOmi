import { z } from 'zod';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';

/**
 * User-documented local exceptions: a market that intentionally does not offer a topic.
 * Keyed by language, then by topic key (readable label when one exists, otherwise the topic id),
 * so an exception survives re-clustering as long as the topic keeps its name.
 * Decision (default chosen by agent): exceptions are stored per project in local storage and only
 * change the parity status shown; they never edit hreflang or publish anything.
 */
export type ParityExceptions = Record<string, Record<string, { reason: string; createdAt: string }>>;

/** Topic key that user exceptions are stored under: the readable label, or the id without one. */
export const parityTopicKey = (topic: string, label?: string): string => label || topic;

export const PARITY_EXCEPTIONS_EVENT = 'seomi:parity-exceptions';
export const MAX_EXCEPTION_REASON = 300;
export const parityExceptionsKey = (projectId: string) => `seomi_project_${projectId}_parity_exceptions_v1`;

const entry = z.object({ reason: z.string().max(MAX_EXCEPTION_REASON), createdAt: z.string().max(40) });
const schema = z.record(z.string().max(35), z.record(z.string().max(500), entry));

export const readParityExceptions = (projectId: string | null): ParityExceptions => {
  if (!projectId) return {};
  const parsed = schema.safeParse(readJsonStorage(parityExceptionsKey(projectId), {}));
  return parsed.success ? parsed.data : {};
};

const save = (projectId: string, value: ParityExceptions): boolean => {
  const saved = writeJsonStorage(parityExceptionsKey(projectId), value);
  if (saved && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PARITY_EXCEPTIONS_EVENT, { detail: parityExceptionsKey(projectId) }));
  return saved;
};

/** Adds an exception (with an optional reason) or removes it when one already exists. */
export const toggleParityException = (projectId: string | null, language: string, topicKey: string, reason = '', now = new Date().toISOString()): boolean => {
  if (!projectId || !language || !topicKey) return false;
  const all = readParityExceptions(projectId);
  const own = { ...(all[language] ?? {}) };
  if (own[topicKey]) delete own[topicKey];
  else own[topicKey] = { reason: reason.trim().slice(0, MAX_EXCEPTION_REASON), createdAt: now };
  const next = { ...all, [language]: own };
  if (!Object.keys(own).length) delete next[language];
  return save(projectId, next);
};

export const setParityExceptionReason = (projectId: string | null, language: string, topicKey: string, reason: string): boolean => {
  const all = readParityExceptions(projectId);
  const current = all[language]?.[topicKey];
  if (!projectId || !current) return false;
  return save(projectId, { ...all, [language]: { ...all[language], [topicKey]: { ...current, reason: reason.trim().slice(0, MAX_EXCEPTION_REASON) } } });
};
