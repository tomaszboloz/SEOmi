import type { HistoryAnnotation, SfsSnapshot } from '@/services/siteFocus';

export interface HistoryPoint { runId: string; at: string; score: number; pageCount: number; delta: number | null }
export interface HistoryMarker { runId: string; at: string; score: number; code: HistoryAnnotation['code']; params: HistoryAnnotation['params']; delta: number }
export interface HistorySeries { points: HistoryPoint[]; markers: HistoryMarker[] }

const round1 = (value: number): number => Math.round(value * 10) / 10;
const time = (value: string): number => { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : 0; };

/** Chart data: one point per full analysis (oldest first) plus a marker for every annotated change. */
export const buildHistorySeries = (snapshots: SfsSnapshot[], annotations: Record<string, HistoryAnnotation[]> = {}): HistorySeries => {
  const ordered = [...snapshots].sort((a, b) => time(a.at) - time(b.at));
  const points = ordered.map((snapshot, index): HistoryPoint => ({
    runId: snapshot.runId, at: snapshot.at, score: snapshot.score, pageCount: snapshot.pageCount,
    delta: index ? round1(snapshot.score - ordered[index - 1].score) : null,
  }));
  const markers = ordered.flatMap((snapshot) => (annotations[snapshot.runId] ?? []).map((annotation): HistoryMarker => ({
    runId: snapshot.runId, at: snapshot.at, score: snapshot.score, code: annotation.code, params: annotation.params, delta: annotation.delta,
  })));
  return { points, markers };
};
