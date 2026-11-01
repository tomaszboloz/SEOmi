import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { PhraseIntentReport } from './phraseIntent';
import { MICRO_INTENTS, type MicroIntent } from './types';

export const SIJA_HISTORY_LIMITS = { perPhrase: 20, phrases: 50 } as const;

/** One stored SIJA run (GEM-69-08): what was observed and on how many really rendered TOP pages. */
export interface SijaHistoryEntry {
  runAt: string;
  intent: MicroIntent | null;
  serpIntent: MicroIntent | null;
  ssas: number | null;
  analysed: number;
  requested: number;
}

const keyFor = (projectId: string) => `seomi_project_${projectId}_sija_history_v1`;
const phraseKey = (phrase: string) => phrase.normalize('NFKC').trim().toLocaleLowerCase();
const intentOrNull = (value: unknown): value is MicroIntent | null => value === null || MICRO_INTENTS.includes(value as MicroIntent);

const isEntry = (value: unknown): value is SijaHistoryEntry => {
  const row = value as SijaHistoryEntry;
  return Boolean(row) && typeof row.runAt === 'string' && intentOrNull(row.intent) && intentOrNull(row.serpIntent)
    && (row.ssas === null || typeof row.ssas === 'number') && typeof row.analysed === 'number' && typeof row.requested === 'number';
};

const readAll = (projectId: string): Record<string, SijaHistoryEntry[]> => {
  const raw = readJsonStorage(keyFor(projectId), {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([phrase, rows]) => [phrase, Array.isArray(rows) ? rows.filter(isEntry) : []]));
};

/** Every phrase of the project, each newest first (used for the site-level HSS scalar). */
export const loadAllSijaHistory = (projectId: string | null): SijaHistoryEntry[][] => projectId ? Object.values(readAll(projectId)) : [];

export const loadSijaHistory = (projectId: string | null, phrase: string): SijaHistoryEntry[] =>
  projectId && phraseKey(phrase) ? readAll(projectId)[phraseKey(phrase)] ?? [] : [];

/** Stores the run for the project's phrase (bounded) and returns the history, newest first. */
export const recordSijaRun = (projectId: string | null, phrase: string, report: PhraseIntentReport, runAt: string): SijaHistoryEntry[] => {
  const key = phraseKey(phrase);
  if (!projectId || !key) return [];
  const entry: SijaHistoryEntry = { runAt, intent: report.page.primary, serpIntent: report.serpIntent.intent, ssas: report.ssas.score, analysed: report.analysed, requested: report.requested };
  const all = readAll(projectId);
  const rows = [entry, ...(all[key] ?? []).filter((row) => row.runAt !== runAt)].slice(0, SIJA_HISTORY_LIMITS.perPhrase);
  writeJsonStorage(keyFor(projectId), Object.fromEntries([[key, rows], ...Object.entries(all).filter(([id]) => id !== key)].slice(0, SIJA_HISTORY_LIMITS.phrases)));
  return rows;
};
