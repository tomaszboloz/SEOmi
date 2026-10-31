import type { WikidataCandidate, WikidataLookup } from './wikidata';

/** A topic of one language version (for example a semantic cluster label). */
export interface LanguageTopic { language: string; topic: string; label: string }

/**
 * Entity link of a topic. `manual` always wins; `exact` means the Wikidata label equals the topic label,
 * `search` is only the first search hit and needs review (#99 GEM-99-03).
 */
export interface EntityLink extends LanguageTopic { qid: string | null; confidence: 'manual' | 'exact' | 'search' | 'none' | 'error'; candidate?: WikidataCandidate }

/** Manual overrides: `${language}|${topic}` to a QID, or null to mark "no entity". */
export type EntityOverrides = Record<string, string | null>;
export const overrideKey = (language: string, topic: string): string => `${language}|${topic}`;

const fold = (value: string): string => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();

export const linkEntity = (topic: LanguageTopic, lookup: WikidataLookup | undefined, overrides: EntityOverrides = {}): EntityLink => {
  const key = overrideKey(topic.language, topic.topic);
  if (key in overrides) return { ...topic, qid: overrides[key], confidence: 'manual' };
  if (!lookup) return { ...topic, qid: null, confidence: 'none' };
  if (lookup.status !== 'ok') return { ...topic, qid: null, confidence: 'error' };
  const exact = lookup.candidates.find((item) => fold(item.label) === fold(topic.label));
  const candidate = exact ?? lookup.candidates[0];
  return candidate ? { ...topic, qid: candidate.id, confidence: exact ? 'exact' : 'search', candidate } : { ...topic, qid: null, confidence: 'none' };
};

/** An entity one language version covers and another does not (alert candidate; never an automatic fix). */
export interface EntityGap { qid: string; label: string; presentIn: string[]; missingIn: string[]; reviewed: boolean }

/**
 * Groups linked topics by language-independent QID and lists, per entity, the languages without any topic for it.
 * `reviewed` is false when any link behind the entity is only a search guess.
 */
export const entityGaps = (links: EntityLink[], languages: string[]): EntityGap[] => {
  const byQid = new Map<string, EntityLink[]>();
  links.forEach((link) => { if (link.qid) byQid.set(link.qid, [...(byQid.get(link.qid) ?? []), link]); });
  return [...byQid].flatMap(([qid, rows]) => {
    const presentIn = [...new Set(rows.map((row) => row.language))].sort();
    const missingIn = languages.filter((language) => !presentIn.includes(language)).sort();
    if (!missingIn.length) return [];
    const label = rows.find((row) => row.candidate?.label)?.candidate?.label ?? rows[0].label;
    return [{ qid, label, presentIn, missingIn, reviewed: rows.every((row) => row.confidence !== 'search') }];
  }).sort((a, b) => b.presentIn.length - a.presentIn.length || (a.qid < b.qid ? -1 : 1));
};
