import type { FocusPage } from '@/services/siteFocus';
import { phraseKey } from '@/services/siteFocus/terms';
import { jaccard, unigramKeys } from './context';

export interface CompetitorPages { domain: string; pages: FocusPage[] }

const MERGE_JACCARD = 0.6;
const PHRASE_JACCARD = 0.5;
const MAX_KEYS = 8;
const MAX_ENTITIES = 10;
export const MAX_QUESTIONS = 5;
const BOILERPLATE_SHARE = 0.3;
const ENTITY_SHARE = 0.5;

interface Candidate { domain: string; label: string; keys: Set<string>; question: boolean; page: FocusPage; rank: number }
/** Heading offset counts only inside the first TOP_HEADINGS headings of a page (#57 GEM-57-03). */
export const TOP_HEADINGS = 20;
export interface Group { label: string; keys: Set<string>; domains: Set<string>; questions: Set<string>; pages: FocusPage[]; suggest: boolean; paa: boolean; aliases: Set<string>; bestRank?: number }

export const tidy = (text: string): string => text.replace(/\s+/g, ' ').trim();
const isQuestion = (text: string): boolean => /[?？]\s*$/.test(text.trim());
const unquestion = (text: string): string => tidy(text).replace(/[?？]\s*$/, '');
const emptyGroup = (label: string, keys: Set<string>): Group => ({ label, keys, domains: new Set(), questions: new Set(), pages: [], suggest: false, paa: false, aliases: new Set() });

const candidatesOf = (competitor: CompetitorPages, language: string): Candidate[] => {
  const seen = new Map<string, number>();
  const live = competitor.pages.filter((page) => page.heading_texts);
  live.forEach((page) => new Set([...(page.heading_texts?.h2 ?? []), ...(page.heading_texts?.h3 ?? [])].map((text) => tidy(text).toLowerCase())).forEach((text) => seen.set(text, (seen.get(text) ?? 0) + 1)));
  const limit = Math.max(2, live.length * BOILERPLATE_SHARE);
  return live.flatMap((page) => [...(page.heading_texts?.h2 ?? []), ...(page.heading_texts?.h3 ?? [])].flatMap((raw, index) => {
    const label = tidy(raw);
    const keys = unigramKeys(label, language);
    if (!keys.size || keys.size > MAX_KEYS || seen.get(label.toLowerCase())! > limit) return [];
    return [{ domain: competitor.domain, label, keys, question: isQuestion(label), page, rank: index + 1 }];
  }));
};

/** Competitor H2/H3 headings merged into sub-topic groups (template boilerplate repeated on many pages is dropped). */
export const headingGroups = (competitors: CompetitorPages[], language: string): Group[] => {
  const groups: Group[] = [];
  competitors.flatMap((competitor) => candidatesOf(competitor, language)).forEach((candidate) => {
    let group = groups.find((item) => jaccard(item.keys, candidate.keys) >= MERGE_JACCARD);
    if (!group) {
      group = emptyGroup(candidate.question ? unquestion(candidate.label) : candidate.label, candidate.keys);
      groups.push(group);
    }
    group.domains.add(candidate.domain);
    group.pages.push(candidate.page);
    if (candidate.rank <= TOP_HEADINGS) group.bestRank = Math.min(group.bestRank ?? candidate.rank, candidate.rank);
    const alias = unquestion(candidate.label);
    if (alias.toLowerCase() !== group.label.toLowerCase()) group.aliases.add(alias);
    if (candidate.question && group.questions.size < MAX_QUESTIONS) group.questions.add(candidate.label);
  });
  return groups;
};

/**
 * Adds user phrasing to the groups: Google Suggest phrases (`suggest`) or real People Also Ask questions (`paa`).
 * A phrase matching no group opens its own sub-topic; every PAA entry is a question even without a trailing mark.
 */
export const addPhrases = (groups: Group[], phrases: string[], language: string, kind: 'suggest' | 'paa'): Group[] => {
  phrases.forEach((phrase) => {
    const keys = unigramKeys(phrase, language);
    if (!keys.size || keys.size > MAX_KEYS) return;
    const asQuestion = kind === 'paa' || isQuestion(phrase);
    let group = groups.find((item) => jaccard(item.keys, keys) >= PHRASE_JACCARD);
    if (!group) {
      group = emptyGroup(unquestion(phrase), keys);
      groups.push(group);
    }
    group[kind] = true;
    if (unquestion(phrase).toLowerCase() !== group.label.toLowerCase()) group.aliases.add(unquestion(phrase));
    if (asQuestion && group.questions.size < MAX_QUESTIONS) group.questions.add(tidy(phrase));
  });
  return groups;
};

/** Entities: terms at least half of the pages under a heading share, minus the heading's own words. */
export const entitiesOf = (group: Group, language: string): string[] => {
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
