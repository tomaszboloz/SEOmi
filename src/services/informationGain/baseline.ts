import { buildIdf, centroidOf, entitiesOf, termCounts, vectorize, type Idf, type Vec } from './text';
import { CONSENSUS_DF, MIN_BASELINE_DOCS, THIN_BASELINE_DOCS, type BaselineDoc } from './types';

const MAX_CONSENSUS = 80;

export interface BaselineChunk { url: string; vec: Vec }

/** SERP consensus: what most top results already say. */
export interface Baseline {
  language: string;
  docs: number;
  urls: string[];
  chunks: BaselineChunk[];
  centroid: Vec;
  idf: Idf;
  /** Consensus entity key -> surface form. */
  consensus: Map<string, string>;
  avgTables: number;
  thin: boolean;
}

export const sectionText = (section: { heading: string; text: string }): string => `${section.heading}. ${section.text}`;

/** Null when fewer than MIN_BASELINE_DOCS competitor pages have readable content. */
export const buildBaseline = (docs: BaselineDoc[], language: string): Baseline | null => {
  const usable = docs.filter((doc) => doc.sections.length);
  if (usable.length < MIN_BASELINE_DOCS) return null;
  const flat = usable.flatMap((doc) => doc.sections.map((section) => ({ url: doc.url, text: sectionText(section) })));
  const counts = flat.map((item) => termCounts(item.text, language));
  const idf = buildIdf(counts);
  const chunks = flat.map((item, index) => ({ url: item.url, vec: vectorize(counts[index], idf) }));

  const entityDocs = new Map<string, { surface: string; docs: number }>();
  usable.forEach((doc) => {
    const own = entitiesOf(doc.sections.map(sectionText).join(' '), language);
    own.forEach((surface, key) => {
      const current = entityDocs.get(key);
      if (current) current.docs += 1;
      else entityDocs.set(key, { surface, docs: 1 });
    });
  });
  const consensus = new Map([...entityDocs]
    .filter(([, item]) => item.docs / usable.length >= CONSENSUS_DF)
    .sort((a, b) => b[1].docs - a[1].docs || (a[0] < b[0] ? -1 : 1))
    .slice(0, MAX_CONSENSUS)
    .map(([key, item]): [string, string] => [key, item.surface]));

  const tables = usable.map((doc) => doc.sections.reduce((sum, section) => sum + section.tables, 0));
  return {
    language, docs: usable.length, urls: usable.map((doc) => doc.url), chunks, centroid: centroidOf(chunks.map((chunk) => chunk.vec)), idf, consensus,
    avgTables: tables.reduce((sum, value) => sum + value, 0) / usable.length, thin: usable.length < THIN_BASELINE_DOCS,
  };
};
