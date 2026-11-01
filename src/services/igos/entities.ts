import { contentStems } from '@/services/embeddings/text';
import { extractTriples } from '@/services/aioReadiness/spo';
import { rulesFor } from '@/services/aioReadiness/languageRules';

/** Limitation code: entities come from capitalised spans and SPO subjects, not from a trained NER model. */
export const HEURISTIC_ENTITIES = 'heuristic-entities';

export const ENTITY_PROFILE = { minSpanStems: 2, maxSpanStems: 4, maxEntities: 80 } as const;

/** Two to four capitalised words in a row, e.g. `World Health Organization`, `Type 2 Diabetes`. */
const PROPER_SPAN = /(?:\p{Lu}[\p{L}\p{N}-]*|\d+)(?:\s+(?:\p{Lu}[\p{L}\p{N}-]*|\d+)){1,3}/gu;

export const spanKey = (value: string): string | null => {
  const stems = contentStems(value);
  return stems.length >= ENTITY_PROFILE.minSpanStems && stems.length <= ENTITY_PROFILE.maxSpanStems ? stems.join(' ') : null;
};

/**
 * Multi-word entity candidates of one text (GEM-67-03): heuristic named-entity spans plus subjects of
 * subject-predicate-object facts. Keys are stem sequences, so case, inflection and an SPO subject that
 * repeats a named span collapse to one alias.
 */
export const entityCandidates = (text: string, language = 'en'): string[] => {
  const keys = new Set<string>();
  for (const match of text.matchAll(PROPER_SPAN)) {
    const key = spanKey(match[0]);
    if (key) keys.add(key);
  }
  const { rules, status } = rulesFor(language);
  if (status !== 'unsupported') extractTriples(text, rules).forEach((triple) => { const key = spanKey(triple.subject); if (key) keys.add(key); });
  return [...keys];
};

/** Entity vocabulary shared by the whole compared corpus, so every document is matched against the same aliases. */
export const entityVocabulary = (texts: string[], language = 'en'): Set<string> => new Set(texts.flatMap((text) => entityCandidates(text, language)));

/**
 * Entities of one text: vocabulary entities found as consecutive stems (longest match first), and the
 * remaining content stems. A stem consumed by a multi-word entity is not counted again, so one fact is
 * never counted twice through its alias, its SPO subject and its words.
 */
export const entitiesFromText = (text: string, vocabulary: ReadonlySet<string>): string[] => {
  const stems = contentStems(text);
  const out = new Set<string>();
  for (let i = 0; i < stems.length && out.size < ENTITY_PROFILE.maxEntities;) {
    let matched = 0;
    for (let size = ENTITY_PROFILE.maxSpanStems; size >= ENTITY_PROFILE.minSpanStems && !matched; size -= 1) {
      const key = stems.slice(i, i + size).join(' ');
      if (i + size <= stems.length && vocabulary.has(key)) { out.add(key); matched = size; }
    }
    if (!matched) out.add(stems[i]);
    i += matched || 1;
  }
  return [...out];
};
