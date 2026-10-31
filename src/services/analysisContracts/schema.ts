import { z } from 'zod';
import { availability, envelope, type Availability, type ReportEnvelope } from './envelope';

/**
 * Wire contract for `ReportEnvelope` (#85 GEM-85-T01/T02). Every boundary (persisted history, MCP payload,
 * PDF input) parses through here, so an old snapshot without the new fields reads as "unknown" with a
 * reason instead of a fabricated 0, and a malformed record is rejected instead of half-trusted.
 */
export const ENVELOPE_CONTRACT_VERSION = 1;

const STATUS = z.enum(['complete', 'partial', 'unavailable', 'stale', 'error', 'cancelled']);
const finite = z.number().refine(Number.isFinite, 'not finite');

const AVAILABILITY = z.object({
  status: STATUS,
  reason: z.string().nullable().optional(),
  coverage: finite.nullable().optional(),
});

const RAW = z.object({
  projectId: z.string().trim().min(1),
  runId: z.string().nullable().optional(),
  module: z.string().trim().min(1),
  algorithmVersion: z.number().int().nonnegative().optional(),
  profileId: z.string().nullable().optional(),
  modelId: z.string().nullable().optional(),
  contentHash: z.string().nullable().optional(),
  generatedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), 'invalid date'),
  availability: AVAILABILITY.optional(),
  value: z.unknown().optional(),
});

export type EnvelopeParse<T> =
  | { ok: true; envelope: ReportEnvelope<T>; legacy: boolean }
  | { ok: false; error: string };

/** True for numbers that are not finite: a NaN score must never pass as a measurement. */
const hasNonFinite = (value: unknown, depth = 0): boolean => {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (!value || typeof value !== 'object' || depth > 8) return false;
  return Object.values(value as Record<string, unknown>).some((item) => hasNonFinite(item, depth + 1));
};

/**
 * Parses an untrusted envelope. A legacy record without `availability` cannot prove completeness: with a
 * value it becomes `stale/legacy-no-availability`, without one `unavailable`. `validate` checks the payload.
 */
export const parseEnvelope = <T>(raw: unknown, validate?: (value: unknown) => value is T): EnvelopeParse<T> => {
  const parsed = RAW.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((issue) => issue.path.join('.') || issue.message).join(', ') };
  const data = parsed.data;
  const value = data.value === undefined ? null : data.value;
  if (value !== null && hasNonFinite(value)) return { ok: false, error: 'value:not-finite' };
  if (value !== null && validate && !validate(value)) return { ok: false, error: 'value:invalid' };
  const legacy = data.availability === undefined || data.algorithmVersion === undefined;
  const state: Availability = data.availability
    ? availability(data.availability.status, data.availability.reason ?? null, data.availability.coverage)
    : value === null ? availability('unavailable', 'legacy-no-value') : availability('stale', 'legacy-no-availability', null);
  return {
    ok: true,
    legacy,
    envelope: envelope<T>({
      projectId: data.projectId, runId: data.runId ?? null, module: data.module, algorithmVersion: data.algorithmVersion ?? 0,
      profileId: data.profileId ?? null, modelId: data.modelId ?? null, contentHash: data.contentHash ?? null,
      generatedAt: data.generatedAt, availability: state, value: value as T | null,
    }),
  };
};

/** Serializes for MCP/PDF/storage with the contract version stamped; `parseEnvelope` reads it back unchanged. */
export const serializeEnvelope = <T>(item: ReportEnvelope<T>): string =>
  JSON.stringify({ contractVersion: ENVELOPE_CONTRACT_VERSION, ...item });
