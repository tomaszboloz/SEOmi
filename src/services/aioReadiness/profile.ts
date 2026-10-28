import type { AioProfile, AioScoreWeights } from './types';

export const AIO_R_PROFILE_ID = 'aio-r';
export const AIO_R_ALGORITHM_VERSION = 'aio-r-2026-10-26';
export const AIO_R_MAX_WORDS = 250;
export const AIO_R_SCORE_WEIGHTS: AioScoreWeights = { selfContainment: 0.4, spo: 0.35, answerFirst: 0.25 };

const hash = (value: string): string => {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return `fnv1a-${(result >>> 0).toString(16).padStart(8, '0')}`;
};

const CONFIG = JSON.stringify({
  maxWords: AIO_R_MAX_WORDS,
  targetWords: 180,
  overlapWords: 30,
  weights: AIO_R_SCORE_WEIGHTS,
  model: { provider: 'local', name: 'lexical-heuristic', dimensions: null, normalization: 'n/a' },
  thresholds: { weakChunk: 50, spoTarget: 1.2 },
});

export const aioRProfile = (language = 'und', market = 'und'): AioProfile => ({
  id: AIO_R_PROFILE_ID,
  algorithmVersion: AIO_R_ALGORITHM_VERSION,
  configHash: hash(CONFIG),
  language,
  market,
  chunking: { maxWords: AIO_R_MAX_WORDS, targetWords: 180, overlapWords: 30 },
  scoreWeights: AIO_R_SCORE_WEIGHTS,
  model: { provider: 'local', name: 'lexical-heuristic', dimensions: null, normalization: 'n/a' },
  fittedCorpusHash: 'none',
  thresholds: { weakChunk: 50, spoTarget: 1.2 },
});

export const legacyAioProfile = (): AioProfile => ({
  ...aioRProfile(), id: 'aio-legacy', algorithmVersion: 'aio-v1', configHash: 'legacy-300-token',
  chunking: { maxWords: 300, targetWords: 300, overlapWords: 60 },
  scoreWeights: { selfContainment: 0.45, spo: 0.35, answerFirst: 0.2 },
});
