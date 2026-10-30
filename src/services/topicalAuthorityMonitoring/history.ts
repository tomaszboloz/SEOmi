import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { CodeParams } from '@/services/siteFocus';
import type { Quadrant, TopicalAuthorityReport } from '@/services/topicalAuthority';
import { AUTHORITY_HISTORY_LIMIT, authorityHistoryKey, validAuthorityProject } from './keys';

export interface AuthoritySnapshot {
  runId: string;
  at: string;
  sfs: number;
  tas: number | null;
  tcr: number | null;
  cdes: number | null;
  silc: number | null;
  cvff: number | null;
  index: number;
  quadrant: Quadrant | null;
  pageCount: number;
  /** Pillar coverage 0-100 by pillar label (reference map pillars). */
  pillars: Record<string, number>;
  /**
   * Scoring profile: TAS formula version plus the reference map identity (topic, language, market, build time).
   * A different profile means TCR/CDES use another denominator, so trends across it are not comparable (#58, #61).
   * Absent on snapshots saved before it existed; those are never rewritten.
   */
  profile?: string;
}

/** Milestones the dual timeline marks: cleanup (SFS), architecture (silos/cannibalization), expansion (coverage), regression. */
export type AuthorityMilestone = 'cleanup' | 'architecture' | 'expansion' | 'regression' | 'incomparable';
export interface AuthorityAnnotation { code: AuthorityMilestone; params: CodeParams }
export interface AuthorityHistoryEntry { snapshot: AuthoritySnapshot; annotations: AuthorityAnnotation[] }

export const MILESTONE_POINTS = 5;
const round1 = (value: number): number => Math.round(value * 10) / 10;

export const authorityProfile = (report: TopicalAuthorityReport): string => {
  const map = report.taxonomy;
  const market = map?.market ? `${map.market.country}-${map.market.language}` : '';
  return [`tas${report.version}`, map ? `${map.coreLabel}|${map.language}|${market}|${map.builtAt}` : 'no-map'].join('|');
};

export const makeAuthoritySnapshot = (report: TopicalAuthorityReport, runId: string): AuthoritySnapshot => ({
  runId, at: report.generatedAt, sfs: report.sfs, tas: report.tas, ...report.pillars, index: report.cannibalizationIndex, quadrant: report.quadrant,
  pageCount: report.pageCount, pillars: Object.fromEntries(report.pillarCoverage.map((pillar) => [pillar.label, pillar.coveragePct])),
  profile: authorityProfile(report),
});

const rise = (next: number | null, previous: number | null): number => (next === null || previous === null ? 0 : next - previous);

/** Names what changed between two full analyses so the chart can explain jumps. */
export const annotateAuthority = (previous: AuthoritySnapshot, next: AuthoritySnapshot): AuthorityAnnotation[] => {
  const notes: AuthorityAnnotation[] = [];
  // Only flagged when both points know their profile: older snapshots are not guessed at.
  if (previous.profile && next.profile && previous.profile !== next.profile) notes.push({ code: 'incomparable', params: {} });
  if (next.sfs - previous.sfs >= MILESTONE_POINTS) notes.push({ code: 'cleanup', params: { delta: round1(next.sfs - previous.sfs) } });
  const silo = rise(next.silc, previous.silc);
  if (silo >= MILESTONE_POINTS || previous.index - next.index >= MILESTONE_POINTS) notes.push({ code: 'architecture', params: { delta: round1(Math.max(silo, previous.index - next.index)) } });
  const coverage = rise(next.tcr, previous.tcr);
  if (coverage >= MILESTONE_POINTS) notes.push({ code: 'expansion', params: { delta: round1(coverage) } });
  const total = rise(next.tas, previous.tas);
  if (total <= -MILESTONE_POINTS) notes.push({ code: 'regression', params: { delta: round1(total) } });
  return notes;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const validEntry = (value: unknown): value is AuthorityHistoryEntry => {
  if (!isRecord(value) || !Array.isArray(value.annotations) || !isRecord(value.snapshot)) return false;
  const snapshot = value.snapshot;
  return typeof snapshot.runId === 'string' && typeof snapshot.at === 'string' && typeof snapshot.sfs === 'number' && isRecord(snapshot.pillars);
};

export const readAuthorityHistory = (projectId: string | null | undefined): AuthorityHistoryEntry[] => {
  if (!validAuthorityProject(projectId)) return [];
  const raw = readJsonStorage(authorityHistoryKey(projectId), []);
  return (Array.isArray(raw) ? raw.filter(validEntry) : []).slice(-AUTHORITY_HISTORY_LIMIT);
};

/** Stores one snapshot per runId; a repeated runId is ignored. */
export const appendAuthorityHistory = (projectId: string, entry: AuthorityHistoryEntry): { saved: boolean; entries: AuthorityHistoryEntry[] } => {
  const current = readAuthorityHistory(projectId);
  if (current.some((item) => item.snapshot.runId === entry.snapshot.runId)) return { saved: false, entries: current };
  const entries = [...current, entry].slice(-AUTHORITY_HISTORY_LIMIT);
  return { saved: writeJsonStorage(authorityHistoryKey(projectId), entries), entries };
};
