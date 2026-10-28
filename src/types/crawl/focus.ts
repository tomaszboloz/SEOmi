/** Weighted n-gram of a page for the Site Focus Score engine. */
export interface FocusTerm {
  /** Folded, lemmatized key (same keying as semanticTermKey); n-grams are space-joined. */
  term: string;
  /** Most frequent surface form on the page. */
  surface: string;
  /** Raw occurrences, not zone weighted. */
  count: number;
  /** Zone-weighted occurrences: title/H1 x2.5, H2-H3 x1.5, body/alt/meta x1. */
  weight: number;
}

/** Heading-delimited section of main content for AI/RAG readiness (level 0 = lead before first heading). */
export interface RagSection {
  heading: string;
  level: number;
  paragraphs: string[];
  tables: number;
  ordered_lists: number;
  unordered_lists: number;
  definition_lists: number;
  /** Optional structural evidence retained by newer crawls. */
  table_headers?: number;
  ordered_list_instruction?: boolean;
  list_item_word_counts?: number[];
}

export interface HeadingTexts {
  h1: string[];
  h2: string[];
  h3: string[];
}
