import type { FocusPage } from '@/services/siteFocus';
import { phraseKey } from '@/services/siteFocus/terms';
import { jaccard, unigramKeys } from './context';
import { TAXONOMY_VERSION, type RefPillar, type RefSubtopic, type ReferenceTaxonomy } from './types';

export interface CompetitorPages { domain: string; pages: FocusPage[] }

export interface TaxonomyInput {
  coreLabel: string;
  /** Term keys of the site's Core Topic: too generic to name a pillar. */
  coreKeys: Set<string>;
  language: string;
  competitors: CompetitorPages[];
  /** Google Suggest style phrases for the Core Topic queries. */
  suggestions: string[];
  source: string;
  now: string;
}

const MERGE_JACCARD = 0.6;
const SUGGEST_JACCARD = 0.5;
const MAX_SUBTOPICS = 60;
const MAX_KEYS = 8;
const MAX_ENTITIES = 10;
const MAX_QUESTIONS = 5;
const BOILERPLATE_SHARE = 0.3;
const COMMON_FROM = 0.1;
const MAX_COMMON = 800;
const ENTITY_SHARE = 0.5;
const GENERAL = 'general';

interface Candidate { domain: string; label: string; keys: Set<string>; question: boolean; page: FocusPage }
interface Group { label: string; keys: Set<string>; domains: Set<string>; questions: Set<string>; pages: FocusPage[]; suggest: boolean }

const tidy = (text: string): string => text.replace(/\s+/g, ' ').trim();
const isQuestion = (text: string): boolean => /[?？]\s*$/.test(text.trim());
const slug = (text: string): string => text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

const candidatesOf = (competitor: CompetitorPages, language: string): Candidate[] => {
  const seen = new Map<string, number>();
  const live = competitor.pages.filter((page) => page.heading_texts);
  live.forEach((page) => new Set([...(page.heading_texts?.h2 ?? []), ...(page.heading_texts?.h3 ?? [])].map((text) => tidy(text).toLowerCase())).forEach((text) => seen.set(text, (seen.get(text) ?? 0) + 1)));
  const limit = Math.max(2, live.length * BOILERPLATE_SHARE);
  return live.flatMap((page) => [...(page.heading_texts?.h2 ?? []), ...(page.heading_texts?.h3 ?? [])].flatMap((raw) => {
    const label = tidy(raw);
    const keys = unigramKeys(label, language);
    if (!keys.size || keys.size > MAX_KEYS || seen.get(label.toLowerCase())! > limit) return [];
    return [{ domain: competitor.domain, label, keys, question: isQuestion(label), page }];
  }));
};

const mergeCandidates = (candidates: Candidate[]): Group[] => {
  const groups: Group[] = [];
  candidates.forEach((candidate) => {
    let group = groups.find((item) => jaccard(item.keys, candidate.keys) >= MERGE_JACCARD);
    if (!group) {
      group = { label: candidate.question ? candidate.label.replace(/[?？]\s*$/, '') : candidate.label, keys: candidate.keys, domains: new Set(), questions: new Set(), pages: [], suggest: false };
      groups.push(group);
    }
    group.domains.add(candidate.domain);
    group.pages.push(candidate.page);
    if (candidate.question && group.questions.size < MAX_QUESTIONS) group.questions.add(candidate.label);
  });
  return groups;
};

const addSuggestions = (groups: Group[], suggestions: string[], language: string): Group[] => {
  suggestions.forEach((phrase) => {
    const keys = unigramKeys(phrase, language);
    if (!keys.size || keys.size > MAX_KEYS) return;
    const group = groups.find((item) => jaccard(item.keys, keys) >= SUGGEST_JACCARD);
    if (group) {
      group.suggest = true;
      if (isQuestion(phrase) && group.questions.size < MAX_QUESTIONS) group.questions.add(tidy(phrase));
    } else groups.push({ label: tidy(phrase).replace(/[?？]\s*$/, ''), keys, domains: new Set(), questions: new Set(isQuestion(phrase) ? [tidy(phrase)] : []), pages: [], suggest: true });
  });
  return groups;
};

/** Entities: terms at least half of the pages under a heading share, minus the heading's own words. */
const entitiesOf = (group: Group, language: string): string[] => {
  const counts = new Map<string, { surface: string; pages: number; weight: number }>();
  group.pages.forEach((page) => (page.focus_terms ?? []).forEach((term) => {
    const key = phraseKey(term.surface || term.term, language);
    if (!key || group.keys.has(key)) return;
    const entry = counts.get(key) ?? { surface: (term.surface || term.term).toLowerCase(), pages: 0, weight: 0 };
    entry.pages += 1;
    entry.weight += term.weight;
    counts.set(key, entry);
  }));
  const need = Math.max(2, Math.ceil(group.pages.length * ENTITY_SHARE));
  return [...counts.values()].filter((entry) => entry.pages >= need).sort((a, b) => b.pages - a.pages || b.weight - a.weight || (a.surface < b.surface ? -1 : 1)).slice(0, MAX_ENTITIES).map((entry) => entry.surface);
};

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

/** Builds the 3-level reference taxonomy (Core -> Pillar -> Sub-topic) from competitor headings and suggestions. */
export const buildTaxonomy = (input: TaxonomyInput): ReferenceTaxonomy | null => {
  const sources = input.competitors.filter((competitor) => competitor.pages.length);
  if (!sources.length) return null;
  const denominator = sources.length + (input.suggestions.length ? 1 : 0);
  const groups = addSuggestions(mergeCandidates(sources.flatMap((competitor) => candidatesOf(competitor, input.language))), input.suggestions, input.language);
  const minSources = Math.min(2, denominator);
  const kept = groups
    .map((group) => ({ group, importance: (group.domains.size + (group.suggest ? 1 : 0)) / denominator }))
    .filter((row) => row.importance * denominator >= minSources)
    .sort((a, b) => b.importance - a.importance || (a.group.label < b.group.label ? -1 : 1))
    .slice(0, MAX_SUBTOPICS);
  if (!kept.length) return null;
  const anchors = assignPillars(kept.map((row) => ({ keys: row.group.keys, label: row.group.label })), input.coreKeys);
  const labels = new Map<string, string>();
  kept.forEach((row, index) => { if (!labels.has(anchors[index])) labels.set(anchors[index], row.group.label.split(/\s+/).find((word) => phraseKey(word, input.language) === anchors[index]) ?? row.group.label); });
  const subtopics: RefSubtopic[] = kept.map((row, index) => ({
    id: `${slug(anchors[index])}-${index + 1}`,
    pillar: anchors[index],
    label: row.group.label,
    keys: [...row.group.keys].sort(),
    importance: Math.round(row.importance * 1000) / 1000,
    entities: entitiesOf(row.group, input.language),
    questions: [...row.group.questions],
  }));
  const pillars: RefPillar[] = [...new Set(anchors)].map((id) => {
    const rows = subtopics.filter((item) => item.pillar === id);
    return { id, label: id === GENERAL ? GENERAL : labels.get(id)!, importance: Math.round((rows.reduce((sum, item) => sum + item.importance, 0) / rows.length) * 1000) / 1000 };
  }).sort((a, b) => b.importance - a.importance || (a.id < b.id ? -1 : 1));
  return { version: TAXONOMY_VERSION, coreLabel: input.coreLabel, language: input.language, builtAt: input.now, source: input.source, competitors: sources.map((item) => item.domain), suggestionCount: input.suggestions.length, pillars, subtopics, commonTerms: commonTermsOf(sources, input.language) };
};
