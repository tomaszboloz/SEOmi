import { phraseKey } from '@/services/siteFocus/terms';
import { addPhrases, entitiesOf, headingGroups, type CompetitorPages } from './taxonomyGroups';
import { TAXONOMY_VERSION, type RefPillar, type RefSubtopic, type ReferenceTaxonomy } from './types';

export type { CompetitorPages } from './taxonomyGroups';

export interface TaxonomyInput {
  coreLabel: string;
  /** Term keys of the site's Core Topic: too generic to name a pillar. */
  coreKeys: Set<string>;
  language: string;
  competitors: CompetitorPages[];
  /** Google Suggest style phrases for the Core Topic queries. */
  suggestions: string[];
  /** Real People Also Ask questions from the same SERPs; empty when the provider did not return the PAA block. */
  paa?: string[];
  source: string;
  now: string;
}

const MAX_SUBTOPICS = 60;
const COMMON_FROM = 0.1;
const MAX_COMMON = 800;
const GENERAL = 'general';

const slug = (text: string): string => text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

const commonTermsOf = (competitors: CompetitorPages[], language: string): Record<string, number> => {
  const pages = competitors.flatMap((competitor) => competitor.pages).filter((page) => page.focus_terms?.length);
  const counts = new Map<string, number>();
  pages.forEach((page) => new Set(page.focus_terms!.map((term) => phraseKey(term.surface || term.term, language)).filter((key): key is string => Boolean(key))).forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1)));
  return Object.fromEntries([...counts].map(([key, count]): [string, number] => [key, count / Math.max(1, pages.length)]).filter(([, share]) => share >= COMMON_FROM).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, MAX_COMMON).map(([key, share]) => [key, Math.round(share * 1000) / 1000]));
};

/** Pillar = most shared non-core word among sub-topics; leftovers share the general pillar. */
const assignPillars = (rows: Array<{ keys: Set<string>; label: string }>, coreKeys: Set<string>): string[] => {
  const frequency = new Map<string, number>();
  rows.forEach((row) => row.keys.forEach((key) => frequency.set(key, (frequency.get(key) ?? 0) + 1)));
  const anchors = rows.map((row) => {
    const pool = [...row.keys].filter((key) => !coreKeys.has(key));
    return (pool.length ? pool : [...row.keys]).sort((a, b) => frequency.get(b)! - frequency.get(a)! || (a < b ? -1 : 1))[0];
  });
  const size = new Map<string, number>();
  anchors.forEach((anchor) => size.set(anchor, (size.get(anchor) ?? 0) + 1));
  return anchors.map((anchor) => (size.get(anchor)! >= 2 ? anchor : GENERAL));
};

/** Builds the 3-level reference taxonomy (Core -> Pillar -> Sub-topic) from competitor headings, Suggest and PAA. */
export const buildTaxonomy = (input: TaxonomyInput): ReferenceTaxonomy | null => {
  const sources = input.competitors.filter((competitor) => competitor.pages.length);
  if (!sources.length) return null;
  const paa = input.paa ?? [];
  const denominator = sources.length + (input.suggestions.length ? 1 : 0) + (paa.length ? 1 : 0);
  const groups = addPhrases(addPhrases(headingGroups(sources, input.language), input.suggestions, input.language, 'suggest'), paa, input.language, 'paa');
  const minSources = Math.min(2, denominator);
  const kept = groups
    .map((group) => ({ group, importance: (group.domains.size + (group.suggest ? 1 : 0) + (group.paa ? 1 : 0)) / denominator }))
    .filter((row) => row.importance * denominator >= minSources)
    .sort((a, b) => b.importance - a.importance || (a.group.label < b.group.label ? -1 : 1))
    .slice(0, MAX_SUBTOPICS);
  if (!kept.length) return null;
  const anchors = assignPillars(kept.map((row) => ({ keys: row.group.keys, label: row.group.label })), input.coreKeys);
  const labels = new Map<string, string>();
  kept.forEach((row, index) => { if (!labels.has(anchors[index])) labels.set(anchors[index], row.group.label.split(/\s+/).find((word) => phraseKey(word, input.language) === anchors[index]) ?? row.group.label); });
  const subtopics: RefSubtopic[] = kept.map((row, index) => {
    const keys = [...row.group.keys].sort();
    return {
      // Derived from the sorted term keys, not the list position: re-ordered sources keep the same ID (#57 GEM-57-T03).
      id: `${slug(anchors[index])}--${slug(keys.join(' '))}`,
      pillar: anchors[index],
      label: row.group.label,
      keys,
      importance: Math.round(row.importance * 1000) / 1000,
      entities: entitiesOf(row.group, input.language),
      questions: [...row.group.questions],
      sources: { domains: [...row.group.domains].sort(), suggest: row.group.suggest, paa: row.group.paa },
    };
  });
  const pillars: RefPillar[] = [...new Set(anchors)].map((id) => {
    const rows = subtopics.filter((item) => item.pillar === id);
    return { id, label: id === GENERAL ? GENERAL : labels.get(id)!, importance: Math.round((rows.reduce((sum, item) => sum + item.importance, 0) / rows.length) * 1000) / 1000 };
  }).sort((a, b) => b.importance - a.importance || (a.id < b.id ? -1 : 1));
  return {
    version: TAXONOMY_VERSION, coreLabel: input.coreLabel, language: input.language, builtAt: input.now, source: input.source,
    competitors: sources.map((item) => item.domain), suggestionCount: input.suggestions.length, paaCount: paa.length,
    pillars, subtopics, commonTerms: commonTermsOf(sources, input.language),
  };
};
