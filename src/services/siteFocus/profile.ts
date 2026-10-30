import { DEFAULT_CLUSTER_CUT } from './cluster';
import { K_CORE_SIZE } from './coreTopic';
import { TYPE_WEIGHT } from './pageType';
import { ZONE_WEIGHT } from './terms';
import { OFF_TOPIC_BELOW, ON_TOPIC_FROM, STRONG_FROM } from './trsPolicy';

/**
 * Versioned Site Focus scoring profile (#83). Every constant that changes a score lives here or is
 * hashed here, so a report, a history snapshot and the PDF can say which profile produced a number.
 *
 * Decision (default chosen by agent, #52/#83 GEM-83-02): keep the 0.3.0 values (TRS x125, SFS bands
 * 90/75/60/40) as the accepted baseline until a calibration run on real, consented crawls justifies a
 * change. A change bumps SFS_ALGORITHM_VERSION and the config hash; history is never recomputed silently.
 */
export const SFS_PROFILE_ID = 'sfs-lexical-tfidf';
export const SFS_ALGORITHM_VERSION = 'sfs-2026-10-30';
/** Raw TRS (about -0.2..1.0) is multiplied by this and clamped to 0-100. */
export const SFS_TRS_SCALE = 125;
export const SFS_SEMANTIC_WEIGHTS = { similarity: 0.5, overlap: 0.3, drift: 0.2 } as const;
export const SFS_LEXICAL_WEIGHTS = { overlap: 0.75, drift: 0.25 } as const;
/** Core keywords present on a page that already count as full overlap. */
export const SFS_OVERLAP_SATURATION = 12;
/** Lower bounds of the domain SFS bands, best first. */
export const SFS_BANDS = { excellent: 90, good: 75, moderate: 60, weak: 40 } as const;

export interface SfsProfileRef { id: string; algorithmVersion: string; configHash: string }
export interface SfsProfile extends SfsProfileRef {
  language: string;
  model: { provider: 'local'; name: 'lexical-tfidf'; dimensions: null; normalization: 'sublinear-tf-idf' };
  trsScale: number;
  bands: typeof SFS_BANDS;
  trsPolicy: { offTopicBelow: number; onTopicFrom: number; strongFrom: number };
}

const hash = (value: string): string => {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return `fnv1a-${(result >>> 0).toString(16).padStart(8, '0')}`;
};

const CONFIG = JSON.stringify({
  trsScale: SFS_TRS_SCALE, semantic: SFS_SEMANTIC_WEIGHTS, lexical: SFS_LEXICAL_WEIGHTS, overlapSaturation: SFS_OVERLAP_SATURATION,
  bands: SFS_BANDS, trsPolicy: [OFF_TOPIC_BELOW, ON_TOPIC_FROM, STRONG_FROM], typeWeight: TYPE_WEIGHT, zoneWeight: ZONE_WEIGHT,
  clusterCut: DEFAULT_CLUSTER_CUT, kCore: K_CORE_SIZE, idf: 'ln(1+N/df)',
});

export const SFS_CONFIG_HASH = hash(CONFIG);

export const sfsProfileRef = (): SfsProfileRef => ({ id: SFS_PROFILE_ID, algorithmVersion: SFS_ALGORITHM_VERSION, configHash: SFS_CONFIG_HASH });

export const sfsProfile = (language = 'und'): SfsProfile => ({
  ...sfsProfileRef(), language: language || 'und',
  model: { provider: 'local', name: 'lexical-tfidf', dimensions: null, normalization: 'sublinear-tf-idf' },
  trsScale: SFS_TRS_SCALE, bands: SFS_BANDS,
  trsPolicy: { offTopicBelow: OFF_TOPIC_BELOW, onTopicFrom: ON_TOPIC_FROM, strongFrom: STRONG_FROM },
});

/** Stable short hash of any JSON-serialisable input (Core Topic config, calibration inputs). */
export const stableHash = (value: unknown): string => hash(JSON.stringify(value) ?? 'undefined');

/**
 * Two scores can be compared only when both name the same profile and config hash. A record saved
 * before #83 has no profile: its provenance is unknown, so it is never treated as comparable.
 */
export const comparableSfsProfiles = (left: SfsProfileRef | undefined, right: SfsProfileRef | undefined): boolean =>
  !!left && !!right && left.id === right.id && left.configHash === right.configHash;
