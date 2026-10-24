import { compareSnapshots } from './compare';
import type { DecayComparison, SerpSnapshot } from './types';

export const DECAY_PROFILE = {
  minSamples: 3,
  /** Centroid shift (1 - cosine) that counts as material. */
  materialShift: 0.1,
  materialEntities: 3,
  /** Change must show against the baseline in this many latest snapshots in a row. */
  persistence: 2,
  cooldownDays: 7,
} as const;

export type DecayVerdict = 'too-few-samples' | 'incompatible' | 'stable' | 'not-persistent' | 'cooldown' | 'alert';

export interface DecayEvaluation {
  verdict: DecayVerdict;
  comparison: DecayComparison | null;
  /** Stable key so the same drift is never alerted twice. */
  dedupeKey: string | null;
  reasons: string[];
}

export const materialReasons = (c: DecayComparison): string[] => {
  const reasons: string[] = [];
  if (c.centroidShift !== null && c.centroidShift >= DECAY_PROFILE.materialShift) reasons.push('centroid');
  if (c.newEntities.length + c.lostEntities.length >= DECAY_PROFILE.materialEntities) reasons.push('entities');
  if (c.intentChange) reasons.push('intent');
  if (c.formatChange) reasons.push('format');
  return reasons;
};

const result = (verdict: DecayVerdict, comparison: DecayComparison | null = null, reasons: string[] = [], dedupeKey: string | null = null): DecayEvaluation => ({ verdict, comparison, reasons, dedupeKey });

/** history is oldest first; the first snapshot is the baseline. Advisory only, never auto-acts. */
export const evaluateDecay = (history: SerpSnapshot[], lastAlertAt: string | null, now: string): DecayEvaluation => {
  if (history.length < DECAY_PROFILE.minSamples) return result('too-few-samples');
  const latest = history[history.length - 1];
  const tail = history.slice(-DECAY_PROFILE.persistence).map((snap) => compareSnapshots(history[0], snap));
  const comparison = tail[tail.length - 1];
  if (tail.some((c) => c.status === 'incompatible')) return result('incompatible', comparison);
  if (tail.some((c) => c.status !== 'ready')) return result('too-few-samples', comparison);
  const reasons = materialReasons(comparison);
  if (!reasons.length) return result('stable', comparison);
  if (tail.some((c) => !materialReasons(c).length)) return result('not-persistent', comparison, reasons);
  const key = `${latest.query}|${latest.country}|${reasons.join('+')}|${history[0].id}`;
  const days = lastAlertAt ? (Date.parse(now) - Date.parse(lastAlertAt)) / 86_400_000 : Infinity;
  return result(days < DECAY_PROFILE.cooldownDays ? 'cooldown' : 'alert', comparison, reasons, key);
};
