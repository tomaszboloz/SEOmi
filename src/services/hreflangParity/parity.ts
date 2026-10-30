export type ParityStatus = 'covered' | 'shallow' | 'missing' | 'intentionally-local';

/** Topic depth (for example words or passages) per language, keyed by reference topic id. */
export type LanguageCoverage = Map<string, number>;

export interface ParityInput {
  referenceLanguage: string;
  /** Depth per reference topic id; topics of other languages must be mapped to these ids first. */
  coverage: Map<string, LanguageCoverage>;
  /** Topics a market intentionally does not offer: language to topic ids. */
  localExceptions?: Map<string, Set<string>>;
  /** True when the crawl behind the coverage is complete. */
  complete: boolean;
  /** A shallow page has less than this share of the reference depth. */
  shallowRatio?: number;
  /** Human-readable names for reference topic ids; ids stay the keys. */
  topicLabels?: Map<string, string>;
}

export interface ParityRow { language: string; topic: string; label?: string; status: ParityStatus; depth: number; referenceDepth: number; reason?: string }

export interface ParityReport {
  status: 'ready' | 'inconclusive';
  rows: ParityRow[];
  /** Why the report cannot be trusted; empty when ready. */
  gaps: string[];
  /** Which pages were compared: members of hreflang clusters, or (no hreflang in the crawl) all pages by document language. */
  scope?: 'hreflang-clusters' | 'document-language';
  /** Hreflang clusters and technical graph issues found; a broken graph is not a content gap. */
  clusters?: number;
  graphIssues?: number;
}

export const SHALLOW_RATIO = 0.5;

/** Compares each language with the reference. Never reports a coverage percentage from empty data. */
export const compareParity = (input: ParityInput): ParityReport => {
  const reference = input.coverage.get(input.referenceLanguage);
  const gaps: string[] = [];
  if (!reference || reference.size === 0) gaps.push('no-reference-coverage');
  if (!input.complete) gaps.push('partial-crawl');
  if (input.coverage.size < 2) gaps.push('single-language');
  if (gaps.length || !reference) return { status: 'inconclusive', rows: [], gaps };
  const ratio = input.shallowRatio ?? SHALLOW_RATIO;
  const rows: ParityRow[] = [];
  [...input.coverage.keys()].filter((lang) => lang !== input.referenceLanguage).sort().forEach((language) => {
    const own = input.coverage.get(language) as LanguageCoverage;
    [...reference.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).forEach(([topic, referenceDepth]) => {
      const depth = own.get(topic) ?? 0;
      const status: ParityStatus = input.localExceptions?.get(language)?.has(topic) ? 'intentionally-local'
        : depth <= 0 ? 'missing' : depth < referenceDepth * ratio ? 'shallow' : 'covered';
      const label = input.topicLabels?.get(topic);
      rows.push({ language, topic, ...(label ? { label } : {}), status, depth, referenceDepth });
    });
  });
  return { status: 'ready', rows, gaps };
};

export const summarize = (report: ParityReport): Record<ParityStatus, number> => {
  const out: Record<ParityStatus, number> = { covered: 0, shallow: 0, missing: 0, 'intentionally-local': 0 };
  report.rows.forEach((row) => { out[row.status] += 1; });
  return out;
};
