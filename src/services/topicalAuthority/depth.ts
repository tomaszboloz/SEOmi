import { phraseKey } from '@/services/siteFocus/terms';
import { unigramKeys, type AuthorityContext, type AuthorityPage } from './context';
import type { DepthInputs, RefSubtopic, ReferenceTaxonomy } from './types';

export const DEPTH_WEIGHTS = { entities: 0.4, questions: 0.35, gain: 0.25 } as const;
const ANSWERED_AT = 0.6;
const GAIN_TOP_TERMS = 30;
const GAIN_MIN_TERMS = 3;

export interface DepthResult {
  /** 0-100, null when no component could be measured. */
  depth: number | null;
  present: string[];
  missing: string[];
  questionsMissing: string[];
  /** Depth components that were really measured; missing ones are left out, never scored as 0 (#58 GEM-58-04). */
  parts: DepthPart[];
}

export type DepthPart = 'entities' | 'questions' | 'gain';

/** Weighted mean over the components that exist; null when none do. */
export const blend = (parts: Array<[number, number | null | undefined]>): number | null => {
  const used = parts.filter((part): part is [number, number] => typeof part[1] === 'number' && Number.isFinite(part[1]));
  const total = used.reduce((sum, [weight]) => sum + weight, 0);
  return total > 0 ? used.reduce((sum, [weight, value]) => sum + weight * value, 0) / total : null;
};

const answered = (question: string, entry: AuthorityPage, language: string): boolean => {
  const keys = unigramKeys(question, language);
  if (!keys.size) return false;
  return [entry.h1, ...entry.headings].some((heading) => [...keys].filter((key) => heading.has(key)).length / keys.size >= ANSWERED_AT);
};

/** Share of the page's strongest Core Topic terms that competitors rarely use (original contribution). */
const informationGain = (entry: AuthorityPage, context: AuthorityContext, common: Record<string, number>): number | null => {
  const top = [...entry.vector].filter(([key]) => context.coreKeys.has(key)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, GAIN_TOP_TERMS);
  return top.length < GAIN_MIN_TERMS ? null : top.filter(([key]) => !(key in common)).length / top.length;
};

/** Depth(d) = 0.4 * entity share + 0.35 * question coverage + 0.25 * information gain, on the parts that exist. */
export const pageDepth = (entry: AuthorityPage, subtopic: RefSubtopic, context: AuthorityContext, taxonomy: ReferenceTaxonomy): DepthResult => {
  const language = context.language;
  const entities = subtopic.entities.map((surface) => ({ surface, key: phraseKey(surface, language) }));
  const present = entities.filter((item) => item.key && entry.keys.has(item.key)).map((item) => item.surface);
  const missing = entities.filter((item) => !present.includes(item.surface)).map((item) => item.surface);
  const questionsMissing = subtopic.questions.filter((question) => !answered(question, entry, language));
  const measured: Record<DepthPart, number | null> = {
    entities: entities.length ? present.length / entities.length : null,
    questions: subtopic.questions.length ? 1 - questionsMissing.length / subtopic.questions.length : null,
    gain: informationGain(entry, context, taxonomy.commonTerms),
  };
  const value = blend((Object.keys(measured) as DepthPart[]).map((part) => [DEPTH_WEIGHTS[part], measured[part]]));
  const parts = (Object.keys(measured) as DepthPart[]).filter((part) => measured[part] !== null);
  return { depth: value === null ? null : Math.round(value * 1000) / 10, present, missing, questionsMissing, parts };
};

const PARTS: DepthPart[] = ['entities', 'questions', 'gain'];

/** Summarizes which depth inputs CDES used, so a partial score is labelled partial instead of looking complete. */
export const depthInputs = (rows: Array<{ coverage: number; depth?: number; depthParts?: DepthPart[] }>): DepthInputs => {
  const scored = rows.filter((row) => row.coverage > 0 && typeof row.depth === 'number');
  const measured = Object.fromEntries(PARTS.map((part) => [part, scored.filter((row) => row.depthParts?.includes(part)).length])) as DepthInputs['measured'];
  const missing = PARTS.filter((part) => measured[part] < scored.length);
  return { status: !scored.length ? 'unavailable' : missing.length ? 'partial' : 'complete', rows: scored.length, measured, missing };
};
