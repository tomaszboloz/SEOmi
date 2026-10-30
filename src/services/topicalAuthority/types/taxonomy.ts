/** Reference Topic Taxonomy: what the market covers for the site's Core Topic (built from real SERP data only). */
export const TAXONOMY_VERSION = 1;

export interface RefPillar { id: string; label: string; importance: number }

export interface RefSubtopic {
  id: string;
  pillar: string;
  label: string;
  /** Folded term keys of the heading phrase (same keying as the Site Focus engine). */
  keys: string[];
  /** Market importance I_j in (0, 1]: share of sources (competitors, suggestions) covering it. */
  importance: number;
  /** Surface forms of entities most of the covering pages mention. */
  entities: string[];
  /** Heading questions and suggestion questions users ask (People Also Ask style). */
  questions: string[];
  /** Provenance: competitor domains whose headings gave this sub-topic, and whether Google Suggest matched it (Suggest is not PAA). */
  sources?: { domains: string[]; suggest: boolean };
}

export interface ReferenceTaxonomy {
  version: number;
  coreLabel: string;
  language: string;
  builtAt: string;
  /** SERP source label, e.g. `dataforseo` or `bing-rss`. */
  source: string;
  competitors: string[];
  suggestionCount: number;
  pillars: RefPillar[];
  subtopics: RefSubtopic[];
  /** Term key -> share (0-1) of competitor pages using it; only terms with share >= 0.1. */
  commonTerms: Record<string, number>;
}
