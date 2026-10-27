import { semanticPageLanguage } from '@/services/semanticText';
import type { Baseline } from './baseline';
import { subtopicDivergence } from './divergence';
import { pageRecommendations } from './recommend';
import { auditSections } from './sections';
import { markersFor } from './signals';
import {
  LEXICAL_THRESHOLDS, WEIGHTS, type IgosBand, type IgosParts, type InfoGainPage, type PageIgos, type SectionZone, type Thresholds,
} from './types';

const NEW_ENTITY_FLOOR = 5;
const NEW_ENTITY_SHARE = 0.35;
const EXPECTED_FACTS_PER_SECTION = 1.8;
const MIN_FACTS = 4;
const FIRST_HAND_TARGET = 3;
const BASE_COVERAGE_FULL = 0.5;

export const bandOf = (score: number): IgosBand =>
  score >= 75 ? 'original' : score >= 55 ? 'good' : score >= 35 ? 'average' : score >= 15 ? 'derivative' : 'echo';

const pct = (value: number): number => Math.round(value * 100);
const empty = (url: string, language: string, skipped: PageIgos['skipped']): PageIgos => ({
  url, score: 0, band: 'echo', parts: { nefr: 0, edsi: 0, sdd: 0, fhem: null }, baseCoverage: 0, foundationMultiplier: 1,
  zones: { echo: 0, gain: 0, drift: 0 }, novelEntities: [], missingConsensus: [], experiencePhrases: [], sections: [], recommendations: [], language, skipped,
});

export interface EvaluateOptions { thresholds?: Thresholds }

/** Information Gain & Originality of one page against the SERP consensus baseline. */
export const evaluatePage = (page: InfoGainPage, baseline: Baseline, options: EvaluateOptions = {}): PageIgos => {
  const language = (semanticPageLanguage(page) ?? baseline.language ?? '').split(/[-_]/)[0].toLowerCase();
  const sections = page.content_sections ?? [];
  if (!sections.length) return empty(page.url, language, 'no-sections');
  const marker = markersFor(language);
  const audited = auditSections(sections, baseline, language, options.thresholds ?? LEXICAL_THRESHOLDS, marker);

  const pageEntities = new Map<string, string>();
  audited.forEach((item) => item.entities.forEach((surface, key) => pageEntities.set(key, surface)));
  const novel = new Set(audited.flatMap((item) => (item.zone === 'drift' ? [] : [...item.entities.keys()])));
  baseline.consensus.forEach((_, key) => novel.delete(key));
  const nefr = Math.min(1, novel.size / Math.max(NEW_ENTITY_FLOOR, NEW_ENTITY_SHARE * baseline.consensus.size));

  const facts = audited.reduce((sum, item) => sum + item.facts, 0);
  const tables = audited.reduce((sum, item) => sum + item.tables, 0);
  const edsi = Math.min(1, (facts / Math.max(MIN_FACTS, audited.length * EXPECTED_FACTS_PER_SECTION)) * 0.75 + Math.min(0.3, tables * 0.15));

  const phrases = [...new Set(audited.flatMap((item) => item.phrases))];
  const fhem = marker ? Math.min(1, phrases.length / FIRST_HAND_TARGET) : null;
  const sdd = subtopicDivergence(audited.map((item) => item.vec), baseline.chunks.map((chunk) => chunk.vec));

  const present = [...baseline.consensus.keys()].filter((key) => pageEntities.has(key)).length;
  const coverage = baseline.consensus.size ? present / baseline.consensus.size : 1;
  const multiplier = coverage >= BASE_COVERAGE_FULL ? 1 : 0.5 + coverage;

  // Without a first-hand list the remaining weights are renormalised instead of scoring zero.
  const active = WEIGHTS.nefr + WEIGHTS.edsi + WEIGHTS.sdd + (fhem === null ? 0 : WEIGHTS.fhem);
  const raw = (WEIGHTS.nefr * nefr + WEIGHTS.edsi * edsi + WEIGHTS.sdd * sdd + (fhem === null ? 0 : WEIGHTS.fhem * fhem)) / active;
  const score = Math.round(raw * multiplier * 100);

  const zones = (zone: SectionZone): number => pct(audited.filter((item) => item.zone === zone).length / audited.length);
  const missing = [...baseline.consensus].filter(([key]) => !pageEntities.has(key)).map(([, surface]) => surface);
  const parts: IgosParts = { nefr: pct(nefr), edsi: pct(edsi), sdd: pct(sdd), fhem: fhem === null ? null : pct(fhem) };
  return {
    url: page.url, score, band: bandOf(score), parts, baseCoverage: pct(coverage), foundationMultiplier: Math.round(multiplier * 1000) / 1000,
    zones: { echo: zones('echo'), gain: zones('gain'), drift: zones('drift') },
    novelEntities: [...novel].map((key) => pageEntities.get(key) ?? key).slice(0, 20), missingConsensus: missing.slice(0, 10), experiencePhrases: phrases,
    sections: audited.map(({ vec: _vec, entities: _entities, tables: _tables, phrases: _phrases, ...audit }) => audit),
    recommendations: pageRecommendations({ parts, raw: { nefr, edsi, fhem }, multiplier, sections: audited, missing, novelCount: novel.size, tables, avgTables: baseline.avgTables }),
    language,
  };
};
