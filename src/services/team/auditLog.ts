import type { Role } from './roles';

export type AuditResult = 'success' | 'denied' | 'failure' | 'dry_run';

export interface AuditInput {
  actor: string;
  role: Role;
  action: string;
  projectId: string;
  result: AuditResult;
  metadata?: Record<string, string | number | boolean | null>;
}

/** Append-only: each entry commits to the previous hash, so any edit or deletion breaks the chain. */
export interface AuditEntry extends AuditInput {
  id: string;
  seq: number;
  at: string;
  prevHash: string;
  hash: string;
}

export const GENESIS_HASH = '0'.repeat(64);

const canonical = (entry: Omit<AuditEntry, 'hash'>): string =>
  JSON.stringify([entry.id, entry.seq, entry.at, entry.actor, entry.role, entry.action, entry.projectId, entry.result, Object.entries(entry.metadata ?? {}).sort(([a], [b]) => a.localeCompare(b)), entry.prevHash]);

export const sha256Hex = async (text: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const appendAudit = async (log: readonly AuditEntry[], input: AuditInput, id: string, now: Date = new Date()): Promise<AuditEntry[]> => {
  const last = log[log.length - 1];
  const base = { ...input, id, seq: (last?.seq ?? 0) + 1, at: now.toISOString(), prevHash: last?.hash ?? GENESIS_HASH };
  return [...log, { ...base, hash: await sha256Hex(canonical(base)) }];
};

export type ChainVerdict = { ok: true } | { ok: false; brokenAt: number; reason: 'seq' | 'prev-hash' | 'hash' };

export const verifyChain = async (log: readonly AuditEntry[]): Promise<ChainVerdict> => {
  let prev = GENESIS_HASH;
  for (const [index, entry] of log.entries()) {
    if (entry.seq !== index + 1) return { ok: false, brokenAt: index, reason: 'seq' };
    if (entry.prevHash !== prev) return { ok: false, brokenAt: index, reason: 'prev-hash' };
    const { hash, ...rest } = entry;
    if (hash !== await sha256Hex(canonical(rest))) return { ok: false, brokenAt: index, reason: 'hash' };
    prev = hash;
  }
  return { ok: true };
};

const csvCell = (value: unknown): string => {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const exportAuditCsv = (log: readonly AuditEntry[]): string =>
  ['seq,id,at,actor,role,action,projectId,result,metadata,prevHash,hash',
    ...log.map((e) => [e.seq, e.id, e.at, e.actor, e.role, e.action, e.projectId, e.result, JSON.stringify(e.metadata ?? {}), e.prevHash, e.hash].map(csvCell).join(','))].join('\n');

export const exportAuditJson = (log: readonly AuditEntry[]): string => JSON.stringify(log, null, 2);
