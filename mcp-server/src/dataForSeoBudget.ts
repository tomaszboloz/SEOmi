import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Optional monthly DataForSEO cap for MCP tools. MCP runs outside the desktop
 * app, so it keeps its own ledger file. Set DATAFORSEO_MONTHLY_LIMIT_USD to
 * enable it; DATAFORSEO_LEDGER_PATH overrides the ledger location.
 */
export interface DataForSeoLedger {
  month: string;
  totalUsd: number;
  calls: number;
}

export const monthKey = (now = new Date()): string => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

export const ledgerPath = (env: Record<string, string | undefined>): string =>
  env.DATAFORSEO_LEDGER_PATH?.trim() || join(homedir(), '.seomi', 'mcp-dataforseo-spend.json');

export const monthlyLimit = (env: Record<string, string | undefined>): number | null => {
  const raw = env.DATAFORSEO_MONTHLY_LIMIT_USD?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error('DATAFORSEO_MONTHLY_LIMIT_USD must be a non-negative number.');
  return value;
};

export const readLedger = (path: string, now = new Date()): DataForSeoLedger => {
  try {
    const stored = JSON.parse(readFileSync(path, 'utf8')) as Partial<DataForSeoLedger>;
    if (stored.month === monthKey(now) && typeof stored.totalUsd === 'number' && Number.isFinite(stored.totalUsd) && typeof stored.calls === 'number') {
      return { month: stored.month, totalUsd: stored.totalUsd, calls: stored.calls };
    }
  } catch {
    // Missing or unreadable ledger: start the month from zero.
  }
  return { month: monthKey(now), totalUsd: 0, calls: 0 };
};

// In-flight reservations and last observed per-request cost, per ledger file (this process only).
const reservedUsd = new Map<string, number>();
const lastCostUsd = new Map<string, number>();
const noRelease = (): void => undefined;

/**
 * Refuses a call before it is sent when the cap is used up, counting requests still in flight.
 * Reserves the last observed request cost (the whole remainder while the cost is unknown) and
 * returns a release function that must run when the request settles.
 */
export const assertMcpBudget = (env: Record<string, string | undefined>, now = new Date()): (() => void) => {
  const limit = monthlyLimit(env);
  if (limit === null) return noRelease;
  const path = ledgerPath(env);
  const ledger = readLedger(path, now);
  const pending = reservedUsd.get(path) ?? 0;
  if (ledger.totalUsd + pending >= limit) {
    const reserved = pending > 0 ? ` (+$${pending.toFixed(4)} reserved by requests in flight)` : '';
    throw new Error(`DataForSEO monthly limit reached: $${ledger.totalUsd.toFixed(4)}${reserved} of $${limit.toFixed(2)} used in ${ledger.month}. Raise DATAFORSEO_MONTHLY_LIMIT_USD or wait for the next month.`);
  }
  const amount = lastCostUsd.get(path) ?? limit - ledger.totalUsd - pending;
  reservedUsd.set(path, pending + amount);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (reservedUsd.get(path) ?? 0) - amount;
    if (left > 1e-9) reservedUsd.set(path, left); else reservedUsd.delete(path);
  };
};

/** Adds the reported cost of one request. Only tracked when a limit is set. Written atomically. */
export const recordMcpCost = (env: Record<string, string | undefined>, costUsd: unknown, now = new Date()): DataForSeoLedger | null => {
  if (monthlyLimit(env) === null) return null;
  const cost = typeof costUsd === 'number' && Number.isFinite(costUsd) && costUsd > 0 ? costUsd : 0;
  const path = ledgerPath(env);
  if (cost > 0) lastCostUsd.set(path, cost);
  const ledger = readLedger(path, now);
  const next = { month: ledger.month, totalUsd: Math.round((ledger.totalUsd + cost) * 1e6) / 1e6, calls: ledger.calls + 1 };
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(next));
  renameSync(temporary, path);
  return next;
};
