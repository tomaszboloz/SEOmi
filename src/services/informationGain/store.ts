import { validProjectId } from '@/services/schedules/policy';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { IgosBand, IgosParts, PageIgos, SectionZone, SiteIgos } from './types';

export const IGOS_HISTORY_LIMIT = 100;
const STORED_PAGES = 60;
const STORED_SECTIONS = 10;

export const validIgosProject = (projectId: string | null | undefined): projectId is string =>
  typeof projectId === 'string' && validProjectId(projectId);

const keyOf = (name: string) => (projectId: string): string => `seomi_project_${projectId}_info_gain_${name}_v1`;
export const igosReportKey = keyOf('report');
export const igosHistoryKey = keyOf('history');

export interface IgosSnapshot {
  runId: string;
  at: string;
  score: number;
  band: IgosBand;
  parts: IgosParts;
  zones: Record<SectionZone, number>;
  docs: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const validSnapshot = (value: unknown): value is IgosSnapshot =>
  isRecord(value) && typeof value.runId === 'string' && typeof value.at === 'string' && typeof value.score === 'number' && isRecord(value.parts) && isRecord(value.zones);

const validReport = (value: unknown): value is StoredIgos =>
  isRecord(value) && isRecord(value.report) && typeof value.runId === 'string' && typeof value.report.score === 'number' && Array.isArray(value.report.pages) && isRecord(value.report.baseline);

export interface StoredIgos { runId: string; report: SiteIgos }

const trimPage = (page: PageIgos): PageIgos => ({ ...page, sections: page.sections.slice(0, STORED_SECTIONS) });

/** Keeps the worst pages only; the score and counts stay those of the full analysis. */
export const compactReport = (report: SiteIgos): SiteIgos => ({ ...report, pages: report.pages.slice(0, STORED_PAGES).map(trimPage) });

export const snapshotOf = (report: SiteIgos, runId: string): IgosSnapshot => ({
  runId, at: report.generatedAt, score: report.score, band: report.band, parts: report.parts, zones: report.zones, docs: report.baseline.docs,
});

export const readIgosReport = (projectId: string | null | undefined): StoredIgos | null => {
  if (!validIgosProject(projectId)) return null;
  const raw = readJsonStorage(igosReportKey(projectId), null);
  return validReport(raw) ? raw : null;
};

export const readIgosHistory = (projectId: string | null | undefined): IgosSnapshot[] => {
  if (!validIgosProject(projectId)) return [];
  const raw = readJsonStorage(igosHistoryKey(projectId), []);
  return (Array.isArray(raw) ? raw.filter(validSnapshot) : []).slice(-IGOS_HISTORY_LIMIT);
};

/** Saves the latest report and appends one history snapshot per runId. */
export const saveIgos = (projectId: string, report: SiteIgos, runId: string): { saved: boolean; history: IgosSnapshot[] } => {
  const history = readIgosHistory(projectId);
  const next = history.some((item) => item.runId === runId) ? history : [...history, snapshotOf(report, runId)].slice(-IGOS_HISTORY_LIMIT);
  const reportSaved = writeJsonStorage(igosReportKey(projectId), { runId, report: compactReport(report) });
  const historySaved = writeJsonStorage(igosHistoryKey(projectId), next);
  return { saved: reportSaved && historySaved, history: next };
};
