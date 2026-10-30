import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { IgosReport } from './report';

export const IGOS_HISTORY_LIMITS = { perPhrase: 20, phrases: 50 } as const;

/** One stored IGOS run: score, basis and the provider/model identity it was measured with. */
export interface IgosHistoryEntry {
  runAt: string;
  targetUrl: string;
  provider: string;
  model: string;
  igos: number | null;
  status: IgosReport['status'];
  availableDocs: number;
  requestedDocs: number;
  docUrls: string[];
}

export type IgosComparison =
  | { kind: 'first' }
  | { kind: 'model-changed'; previous: IgosHistoryEntry }
  | { kind: 'baseline-changed' | 'same-basis'; previous: IgosHistoryEntry; delta: number | null };

const keyFor = (projectId: string) => `seomi_project_${projectId}_igos_history_v1`;
const phraseKey = (phrase: string) => phrase.normalize('NFKC').trim().toLocaleLowerCase();

const isEntry = (value: unknown): value is IgosHistoryEntry => {
  const row = value as IgosHistoryEntry;
  return Boolean(row) && typeof row.runAt === 'string' && typeof row.provider === 'string' && typeof row.model === 'string'
    && (row.igos === null || typeof row.igos === 'number') && Array.isArray(row.docUrls);
};

const readAll = (projectId: string): Record<string, IgosHistoryEntry[]> => {
  const raw = readJsonStorage(keyFor(projectId), {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>)
    .map(([phrase, rows]) => [phrase, Array.isArray(rows) ? rows.filter(isEntry) : []]));
};

/** Newest first; empty without a project or phrase. */
export const loadIgosHistory = (projectId: string | null, phrase: string): IgosHistoryEntry[] =>
  projectId && phraseKey(phrase) ? readAll(projectId)[phraseKey(phrase)] ?? [] : [];

export const historyEntry = (report: IgosReport): IgosHistoryEntry | null => report.provenance ? {
  runAt: report.provenance.runAt, targetUrl: report.provenance.targetUrl, provider: report.provenance.provider, model: report.provenance.model,
  igos: report.igos, status: report.status, availableDocs: report.availableDocs, requestedDocs: report.requestedDocs,
  docUrls: report.provenance.docs.map((doc) => doc.url),
} : null;

/** Stores a run (bounded per phrase and per project) and returns the phrase history, newest first. */
export const recordIgosRun = (projectId: string | null, phrase: string, report: IgosReport): IgosHistoryEntry[] => {
  const entry = historyEntry(report);
  const key = phraseKey(phrase);
  if (!projectId || !key || !entry) return loadIgosHistory(projectId, phrase);
  const all = readAll(projectId);
  const rows = [entry, ...(all[key] ?? []).filter((row) => row.runAt !== entry.runAt)].slice(0, IGOS_HISTORY_LIMITS.perPhrase);
  const next = Object.fromEntries([[key, rows], ...Object.entries(all).filter(([phraseId]) => phraseId !== key)].slice(0, IGOS_HISTORY_LIMITS.phrases));
  writeJsonStorage(keyFor(projectId), next);
  return rows;
};

/**
 * GEM-68-06: a different provider/model is not comparable, so no delta is shown (a model change is not a
 * page quality drop). A different TOP set keeps the delta but is flagged as a baseline change.
 */
export const compareIgosRuns = (current: IgosHistoryEntry, previous: IgosHistoryEntry | undefined): IgosComparison => {
  if (!previous) return { kind: 'first' };
  if (previous.provider !== current.provider || previous.model !== current.model) return { kind: 'model-changed', previous };
  const delta = current.igos === null || previous.igos === null ? null : current.igos - previous.igos;
  const sameDocs = previous.docUrls.length === current.docUrls.length && previous.docUrls.every((url, index) => url === current.docUrls[index]);
  return { kind: sameDocs ? 'same-basis' : 'baseline-changed', previous, delta };
};
