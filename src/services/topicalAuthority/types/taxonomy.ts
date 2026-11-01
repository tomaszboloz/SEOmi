/** Reference Topic Taxonomy: what the market covers for the site's Core Topic (built from real SERP data only). */
export const TAXONOMY_VERSION = 1;

export interface RefPillar {
  id: string;
  label: string;
  importance: number;
  /** Optional Knowledge Graph link (Wikidata item ID) added on explicit user action (#57). */
  entityId?: string;
  /** `exact`: the item label equals the pillar label. `search`: first search hit, needs review. */
  entityMatch?: 'exact' | 'search';
}

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
  /** Questions from competitor headings, Suggest phrases and, when the provider returned it, the real People Also Ask block. */
  questions: string[];
  /** Provenance: competitor domains whose headings gave this sub-topic, and whether Google Suggest matched it (Suggest is not PAA). */
  /** Other phrasings that merged into this node (competitor headings, Suggest, PAA), without the node label. */
  aliases?: string[];
  /** Evidence confidence 0-1: share of evidence kinds (headings, Suggest, PAA) present. Not a probability. */
  confidence?: number;
  /** Best (lowest) position 1..20 of a matching heading within its page's H2/H3 list; absent when only beyond TOP 20 or from Suggest/PAA. */
  rank?: number;
  sources?: { domains: string[]; suggest: boolean; paa?: boolean };
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
  /** Real People Also Ask questions used (0 or absent: no PAA source, not "no questions"). */
  paaCount?: number;
  /** Market (country/language) the reference SERP was fetched for; part of the cache identity (#57 GEM-57-07). */
  market?: { country: string; language: string };
  pillars: RefPillar[];
  subtopics: RefSubtopic[];
  /** Term key -> share (0-1) of competitor pages using it; only terms with share >= 0.1. */
  commonTerms: Record<string, number>;
}
