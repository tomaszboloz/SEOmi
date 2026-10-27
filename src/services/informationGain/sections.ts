import type { ContentSection } from '@/types';
import type { Baseline } from './baseline';
import { sectionText } from './baseline';
import { countMatches, EMPIRICAL_PATTERNS, phrasesIn } from './signals';
import { cosine, entitiesOf, termCounts, vectorize, type Vec } from './text';
import type { SectionAudit, SectionZone, Thresholds } from './types';

const FACT_BONUS = 5;
const FACT_BONUS_CAP = 25;
const EXPERIENCE_BONUS = 15;
const ECHO_SHARE = 0.5;

export interface AuditedSection extends SectionAudit {
  vec: Vec;
  entities: Map<string, string>;
  tables: number;
  phrases: string[];
}

export const zoneOf = (maxSerp: number, topic: number, limits: Thresholds): SectionZone =>
  maxSerp >= limits.echo ? 'echo' : topic >= limits.topic ? 'gain' : 'drift';

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Paragraph-level novelty gate: Echo adds nothing, Drift is rejected, Gain scores what competitors lack. */
export const auditSections = (
  sections: ContentSection[], baseline: Baseline, language: string, limits: Thresholds, marker: RegExp | undefined,
): AuditedSection[] => sections.map((section) => {
  const text = sectionText(section);
  const vec = vectorize(termCounts(text, language), baseline.idf);
  let maxSerp = 0;
  let closest = baseline.chunks[0]?.url ?? '';
  baseline.chunks.forEach((chunk) => {
    const similarity = cosine(vec, chunk.vec);
    if (similarity > maxSerp) { maxSerp = similarity; closest = chunk.url; }
  });
  const topic = cosine(vec, baseline.centroid);
  const zone = zoneOf(maxSerp, topic, limits);
  const facts = countMatches(text, EMPIRICAL_PATTERNS);
  const phrases = marker ? phrasesIn(text, marker) : [];
  const entities = entitiesOf(text, language);
  const novelEntities = zone === 'drift' ? [] : [...entities].filter(([key]) => !baseline.consensus.has(key)).map(([, surface]) => surface);
  const base = zone === 'gain' ? 100 * (1 - maxSerp) : zone === 'echo' ? 100 * (1 - maxSerp) * ECHO_SHARE : 0;
  const bonus = zone === 'drift' ? 0 : Math.min(FACT_BONUS_CAP, facts * FACT_BONUS) + (phrases.length ? EXPERIENCE_BONUS : 0);
  return {
    heading: section.heading, level: section.level, zone, novelty: Math.round(Math.min(100, base + bonus)),
    maxSerpSimilarity: round1(maxSerp * 100) / 100, topicRelevance: round1(topic * 100) / 100, closestUrl: closest,
    novelEntities: novelEntities.slice(0, 8), facts, firstHand: phrases.length > 0, vec, entities, tables: section.tables, phrases,
  };
});
