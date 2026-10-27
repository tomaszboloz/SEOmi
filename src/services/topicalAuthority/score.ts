import { blend } from './depth';
import type { Pillars, Quadrant } from './types';

export const TAS_WEIGHTS = { tcr: 0.35, cdes: 0.3, silc: 0.25, cvff: 0.1 } as const;
export const CVFF_WEIGHTS = { freshness: 0.6, uniqueness: 0.4 } as const;
export const STRONG_FROM = 75;
export const GOOD_TAS_FROM = 60;

/** mu_SFS = 0.7 + 0.3 * SFS / 100: a diluted domain builds authority more slowly. */
export const focusMultiplier = (sfs: number): number => 0.7 + 0.3 * (Math.max(0, Math.min(100, sfs)) / 100);

/** CVFF = (0.6 * freshness ratio + 0.4 * (1 - cannibalization index)) * 100, on the parts that exist. */
export const velocityScore = (freshnessRatio: number | null, cannibalizationIndex: number): number => {
  const value = blend([[CVFF_WEIGHTS.freshness, freshnessRatio], [CVFF_WEIGHTS.uniqueness, 1 - Math.min(100, cannibalizationIndex) / 100]]) as number;
  return Math.round(value * 1000) / 10;
};

export interface Aggregate { tasRaw: number | null; tas: number | null; multiplier: number; unavailable: Array<keyof Pillars> }

/** TAS_raw = 0.35 TCR + 0.30 CDES + 0.25 SILC + 0.10 CVFF (pillars that cannot be measured drop out and the rest rescale). */
export const aggregateTas = (pillars: Pillars, sfs: number): Aggregate => {
  const multiplier = focusMultiplier(sfs);
  const keys = Object.keys(TAS_WEIGHTS) as Array<keyof Pillars>;
  const unavailable = keys.filter((key) => pillars[key] === null);
  const tasRaw = pillars.tcr === null ? null : blend(keys.map((key): [number, number | null] => [TAS_WEIGHTS[key], pillars[key]]));
  return { tasRaw: tasRaw === null ? null : Math.round(tasRaw * 10) / 10, tas: tasRaw === null ? null : Math.round(tasRaw * multiplier), multiplier: Math.round(multiplier * 1000) / 1000, unavailable };
};

/** Topical Maturity Quadrant from the SFS (x) and TAS (y) axes. */
export const quadrantFor = (sfs: number, tas: number): Quadrant => {
  if (sfs >= STRONG_FROM) return tas >= STRONG_FROM ? 'dominant_authority' : 'boutique_specialist';
  return tas >= GOOD_TAS_FROM ? 'diluted_giant' : 'unfocused_generalist';
};

/** Unrounded TAS for what-if simulations; null without a TCR. */
export const simulateTas = (pillars: Pillars, sfs: number): number | null => {
  const keys = Object.keys(TAS_WEIGHTS) as Array<keyof Pillars>;
  const raw = pillars.tcr === null ? null : blend(keys.map((key): [number, number | null] => [TAS_WEIGHTS[key], pillars[key]]));
  return raw === null ? null : raw * focusMultiplier(sfs);
};
