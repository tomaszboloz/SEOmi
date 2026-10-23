import type { SearchIntent } from '@/services/topicalDocument/types';
import { MICRO_INTENTS, type Funnel, type MicroIntent, type ObservedMicroIntent, type PageFeatures } from './types';

const W = {
  definitional: /what is|what are|definition|co to jest|czym jest|was ist|qu'est-ce|qué es|cos'è|o que é/i,
  howTo: /how to|jak |wie man|cómo|comment |come |como /i,
  trouble: /error|fix|not working|troubleshoot|problem|błąd|napraw|nie działa|fehler|lösung|solución|erreur|errore|erro/i,
  compare: /\bvs\b|versus|compar|porówn|vergleich|différence|differenza|diferença|diferencia/i,
  list: /\bbest\b|\btop \d|najlepsz|beste|mejores|meilleurs|migliori|melhores|\d+ (?:ways|tools|tips|sposob|tipps)/i,
};
const cap = (n: number, max: number) => Math.min(1, n / max);

export const scoreIntents = (f: PageFeatures): Record<MicroIntent, number> => {
  const has = (re: RegExp) => (re.test(f.headingText) ? 1 : 0);
  const lists = f.orderedLists + f.unorderedLists;
  return {
    definitional: has(W.definitional) * 0.8 + (f.words >= 300 ? 0.2 : 0) * has(W.definitional),
    'how-to': has(W.howTo) * 0.5 + cap(f.orderedLists, 1) * 0.5,
    troubleshooting: has(W.trouble) * 0.7 + cap(f.orderedLists, 1) * 0.3 * has(W.trouble),
    comparison: has(W.compare) * 0.5 + cap(f.tables, 1) * 0.5,
    'curated-list': has(W.list) * 0.6 + cap(lists, 2) * 0.2 + cap(f.productCards, 3) * 0.2,
    tool: cap(f.calculators, 1) * 0.7 + cap(f.formInputs, 1) * 0.3 * cap(f.calculators, 1),
    transactional: cap(f.productCards, 1) * 0.6 + cap(f.formInputs, 1) * 0.2 * cap(f.productCards, 1) + cap(f.productCards, 3) * 0.2,
    local: cap(f.localSignals, 2),
  };
};

const MIXED_RATIO = 0.8;
const MIN_SCORE = 0.3;

/** Observed micro-intent from page structure. Never overwrites the manual SearchIntent. */
export const classify = (f: PageFeatures): ObservedMicroIntent => {
  const scores = scoreIntents(f);
  const ranked = MICRO_INTENTS.map((name) => ({ name, score: scores[name] })).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (top.score < MIN_SCORE) return { primary: null, mixed: [], confidence: 0, scores, evidence: [] };
  const mixed = ranked.slice(1).filter((r) => r.score >= MIN_SCORE && r.score >= top.score * MIXED_RATIO).map((r) => r.name);
  const evidence = [`tables=${f.tables}`, `ol=${f.orderedLists}`, `ul=${f.unorderedLists}`, `inputs=${f.formInputs}`, `calculators=${f.calculators}`, `products=${f.productCards}`, `local=${f.localSignals}`];
  return { primary: top.name, mixed, confidence: Math.round(top.score * (mixed.length ? 0.8 : 1) * 100) / 100, scores, evidence };
};

/** Coarse mapping to the existing 6-class contract, kept as a separate observed value. */
export const toSearchIntent = (m: ObservedMicroIntent): SearchIntent => {
  if (!m.primary) return 'unknown';
  if (m.mixed.length) return 'mixed';
  if (m.primary === 'transactional' || m.primary === 'tool') return 'transactional';
  if (m.primary === 'comparison' || m.primary === 'curated-list') return 'commercial';
  if (m.primary === 'local') return 'navigational';
  return 'informational';
};

const STAGE: Record<MicroIntent, Funnel> = {
  definitional: 'TOFU', 'how-to': 'TOFU', troubleshooting: 'TOFU', comparison: 'MOFU', 'curated-list': 'MOFU', tool: 'MOFU', transactional: 'BOFU', local: 'BOFU',
};

/** Funnel map from real classified pages: only counts, no invented traffic shares. */
export const funnelCounts = (items: ObservedMicroIntent[]): Record<Funnel, number> => {
  const out: Record<Funnel, number> = { TOFU: 0, MOFU: 0, BOFU: 0 };
  items.forEach((item) => { if (item.primary) out[STAGE[item.primary]] += 1; });
  return out;
};
