import { readStorage, removeStorage, writeStorageResult } from '@/services/storage';

/**
 * Versioned, atomic persistence for analysis artifacts (#85 GEM-85-07/08, T03). Records carry a schema
 * version; reads migrate forward step by step and a failing step leaves the stored record untouched
 * (rollback). Corrupt JSON is quarantined, not silently replaced by defaults. A record written by a newer
 * app version is read-only. Writes verify read-back and restore the previous value on any failure.
 */
export interface VersionedRecord<T> { schemaVersion: number; data: T }

/** `migrations[n]` lifts data from version n to n + 1. */
export interface VersionedSpec<T> {
  key: string;
  version: number;
  migrations: Record<number, (data: unknown) => unknown>;
  validate: (data: unknown) => data is T;
}

export type ReadOutcome<T> =
  | { status: 'ok'; data: T; migratedFrom: number | null }
  | { status: 'missing' }
  | { status: 'corrupt'; quarantineKey: string }
  | { status: 'newer-version'; version: number }
  | { status: 'migration-failed'; fromVersion: number; step: number; error: string }
  | { status: 'invalid' };

export type WriteOutcome = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' | 'verify-failed' | 'serialize'; rolledBack: boolean };

export const quarantineKey = (key: string): string => `${key}::corrupt`;

const isQuota = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'QuotaExceededError' || /quota/iu.test(error.message));

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const writeVersioned = <T>(spec: VersionedSpec<T>, data: T): WriteOutcome => {
  let serialized: string;
  try {
    serialized = JSON.stringify({ schemaVersion: spec.version, data } satisfies VersionedRecord<T>);
  } catch {
    return { ok: false, reason: 'serialize', rolledBack: false };
  }
  const previous = readStorage(spec.key);
  const result = writeStorageResult(spec.key, serialized);
  if (result.ok && readStorage(spec.key) === serialized) return { ok: true };
  const rolledBack = previous === null ? removeStorage(spec.key) || readStorage(spec.key) === null : writeStorageResult(spec.key, previous).ok;
  const reason = result.ok ? 'verify-failed' : isQuota(result.error) ? 'quota' : 'unavailable';
  return { ok: false, reason, rolledBack };
};

const migrate = (data: unknown, from: number, spec: VersionedSpec<unknown>): { data: unknown } | { step: number; error: string } => {
  let current = data;
  for (let step = from; step < spec.version; step += 1) {
    const lift = spec.migrations[step];
    if (!lift) return { step, error: 'missing-migration' };
    try {
      current = lift(structuredClone(current));
    } catch (error) {
      return { step, error: errorText(error) };
    }
  }
  return { data: current };
};

/** Reads and, when needed, migrates and re-persists the record. Never overwrites on failure. */
export const readVersioned = <T>(spec: VersionedSpec<T>): ReadOutcome<T> => {
  const raw = readStorage(spec.key);
  if (raw === null) return { status: 'missing' };
  let record: unknown;
  try {
    record = JSON.parse(raw);
  } catch {
    writeStorageResult(quarantineKey(spec.key), raw);
    return { status: 'corrupt', quarantineKey: quarantineKey(spec.key) };
  }
  const candidate = record as Partial<VersionedRecord<unknown>> | null;
  const version = candidate && typeof candidate === 'object' && Number.isInteger(candidate.schemaVersion) ? candidate.schemaVersion as number : 0;
  const data = version === 0 && !(candidate && 'data' in candidate) ? record : candidate?.data;
  if (version > spec.version) return { status: 'newer-version', version };
  if (version === spec.version) return spec.validate(data) ? { status: 'ok', data, migratedFrom: null } : { status: 'invalid' };
  const lifted = migrate(data, version, spec as VersionedSpec<unknown>);
  if ('error' in lifted) return { status: 'migration-failed', fromVersion: version, step: lifted.step, error: lifted.error };
  if (!spec.validate(lifted.data)) return { status: 'migration-failed', fromVersion: version, step: spec.version, error: 'invalid-after-migration' };
  writeVersioned(spec, lifted.data);
  return { status: 'ok', data: lifted.data, migratedFrom: version };
};
