import type { HssModule } from './types';

export interface HssProfile {
  id: string;
  version: number;
  weights: Readonly<Record<HssModule, number>>;
  minAvailableWeight: number;
}

/**
 * HSS profile v1 (#72, GEM-72-02): weights from the Gemini specification, summing to 1.
 * HSS is an SEOmi heuristic, not a Google metric, and is separate from the technical audit score.
 *
 * Decision (default chosen by agent, GEM-72-D01): a value is shown only when the measured modules carry at
 * least half of the nominal weight. Below that the renormalised number is kept in the report for transparency
 * but the HSS is reported as `insufficient`, never as a complete-looking score.
 */
export const HSS_PROFILE: HssProfile = {
  id: 'hss-gemini-7',
  version: 1,
  weights: { sfs: 0.2, tas: 0.25, igos: 0.15, sprs: 0.15, eetv: 0.1, sija: 0.1, aior: 0.05 },
  minAvailableWeight: 0.5,
};
