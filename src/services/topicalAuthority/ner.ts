/**
 * Deterministic local entity recognition for headings and titles (#58 GEM-58-04, owner default: no mandatory model).
 * Finds capitalised names, acronyms and letter-digit model codes. Scripts without letter case (Japanese, Chinese, Arabic)
 * only yield model codes, so for those the lexical focus terms remain the main entity source.
 */
export type EntityMode = 'lexical' | 'heuristic' | 'ollama';
export const ENTITY_MODES: readonly EntityMode[] = ['lexical', 'heuristic', 'ollama'];
/** `heuristic` switches the local recogniser on; `extra` are names an optional local model recognised (matched against page text). */
export interface EntityOptions { heuristic?: boolean; extra?: string[] }

const MAX_SPAN_WORDS = 4;
const MIN_LENGTH = 3;
const ACRONYM = /^\p{Lu}{2,}$/u;
const MODEL_CODE = /^(?=.*\p{L})(?=.*\d)[\p{L}\p{N}-]{2,}$/u;
const NAME_WORD = /^\p{Lu}[\p{L}\p{N}'’-]*$/u;

/** Entity surfaces of one text, lowercased. The first word of a heading is skipped unless it is an acronym or model code (it is capitalised anyway). */
export const heuristicEntities = (text: string): string[] => {
  const words = text.split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean);
  const found = new Set<string>();
  let span: string[] = [];
  const flush = () => {
    if (span.length) found.add(span.join(' ').toLowerCase());
    span = [];
  };
  words.forEach((word, index) => {
    const strong = ACRONYM.test(word) || MODEL_CODE.test(word);
    if (strong || (index > 0 && NAME_WORD.test(word))) {
      if (span.length >= MAX_SPAN_WORDS) flush();
      span.push(word);
    } else flush();
  });
  flush();
  return [...found].filter((surface) => surface.length >= MIN_LENGTH);
};
