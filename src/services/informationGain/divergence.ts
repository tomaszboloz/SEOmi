import { cosine, type Vec } from './text';

const BINS = 6;
const FLOOR = 0.01;
const NORMALIZER = 0.35;
const NEUTRAL = 0.5;

const profile = (vectors: Vec[], anchors: Vec[]): number[] => {
  const mean = anchors.map((anchor) => vectors.reduce((sum, vec) => sum + Math.max(FLOOR, cosine(vec, anchor)), 0) / vectors.length);
  const total = mean.reduce((sum, value) => sum + value, 0);
  return mean.map((value) => value / total);
};

const kl = (left: number[], right: number[]): number => left.reduce((sum, value, index) => sum + value * Math.log(value / right[index]), 0);

/**
 * Subtopic Distribution Divergence (0-1): Jensen-Shannon distance between how the page and the SERP
 * spread attention over evenly spaced SERP paragraphs. 0.5 when the baseline is too small to anchor.
 */
export const subtopicDivergence = (page: Vec[], serp: Vec[]): number => {
  if (!page.length || serp.length < BINS) return NEUTRAL;
  const anchors = Array.from({ length: BINS }, (_, index) => serp[Math.floor((index * (serp.length - 1)) / (BINS - 1))]);
  const p = profile(page, anchors);
  const q = profile(serp, anchors);
  const mid = p.map((value, index) => (value + q[index]) / 2);
  const distance = Math.sqrt(Math.max(0, 0.5 * kl(p, mid) + 0.5 * kl(q, mid)));
  return Math.min(1, distance / NORMALIZER);
};
