import { createId } from '@/services/ids';
import { appendAudit, verifyChain, type AuditEntry, type AuditInput } from './auditLog';

export const AUDIT_STORAGE_KEY = 'seomi:team:audit-log';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const isEntry = (value: unknown): value is AuditEntry => {
  const e = value as Partial<AuditEntry> | null;
  return !!e && typeof e.seq === 'number' && typeof e.hash === 'string' && typeof e.prevHash === 'string' && typeof e.id === 'string';
};

export const readAuditLog = (store: KeyValueStore): AuditEntry[] => {
  try {
    const parsed: unknown = JSON.parse(store.getItem(AUDIT_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
};

/** Refuses to extend a log whose chain is already broken, so tampering is never silently continued. */
export const recordAudit = async (store: KeyValueStore, input: AuditInput, now?: Date): Promise<AuditEntry> => {
  const log = readAuditLog(store);
  const verdict = await verifyChain(log);
  if (!verdict.ok) throw new Error(`Audit log tampered at entry ${verdict.brokenAt + 1} (${verdict.reason})`);
  const next = await appendAudit(log, input, createId('audit'), now);
  store.setItem(AUDIT_STORAGE_KEY, JSON.stringify(next));
  return next[next.length - 1];
};
