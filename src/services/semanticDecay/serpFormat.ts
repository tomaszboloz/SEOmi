/**
 * Dominant TOP K format for the Decay Radar (#98 GEM-98-03). Deterministic URL heuristic, no model: each
 * result URL is tagged from host and path patterns, unknown URLs stay `null`, and a format is dominant only
 * when it holds a clear majority of the classified results with enough coverage. Otherwise the snapshot
 * keeps `null`, so a noisy SERP never produces a format-change alert. Intent is derived from the format
 * only for unambiguous formats (shop pages → transactional, guides → informational).
 */
export type SerpFormat = 'video' | 'forum' | 'product' | 'category' | 'guide' | 'listicle' | 'news' | 'tool' | 'encyclopedia' | 'homepage';

export const SERP_FORMAT_MODEL = 'url-heuristic-v1';
/** Share of classified results the top format needs, and share of all results that must be classified. */
export const FORMAT_MAJORITY = 0.5;
export const FORMAT_MIN_COVERAGE = 0.5;

const HOSTS: Array<[RegExp, SerpFormat]> = [
  [/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|dailymotion\.com)$/u, 'video'],
  [/(^|\.)(reddit\.com|quora\.com|stackexchange\.com|stackoverflow\.com|wykop\.pl|forum\.[^.]+\.[a-z]+)$/u, 'forum'],
  [/(^|\.)wikipedia\.org$/u, 'encyclopedia'],
];
const PATHS: Array<[RegExp, SerpFormat]> = [
  [/\/(forum|forums|thread|threads|topic|watek|community)\//u, 'forum'],
  [/\/(product|produkt|products|p|dp|item|sklep\/[^/]+\/[^/]+)\//u, 'product'],
  [/\/(category|categories|kategoria|kategorie|c|collections|shop|sklep)\//u, 'category'],
  [/\/(news|aktualnosci|wiadomosci|press)\//u, 'news'],
  [/\/(top-?\d+|ranking|best-|najlepsze|zestawienie)/u, 'listicle'],
  [/\/(calculator|kalkulator|tool|narzedzie|generator|converter)/u, 'tool'],
  [/\/(blog|poradnik|guide|guides|how-to|jak-|artykul|article|articles|wiki)\b/u, 'guide'],
];

export const classifySerpUrl = (value: string): SerpFormat | null => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./u, '');
  const hostHit = HOSTS.find(([pattern]) => pattern.test(host));
  if (hostHit) return hostHit[1];
  const path = `${url.pathname.toLowerCase().replace(/\/+$/u, '')}/`;
  if (path === '/') return 'homepage';
  return PATHS.find(([pattern]) => pattern.test(path))?.[1] ?? null;
};

export interface FormatSummary {
  dominantFormat: SerpFormat | null;
  dominantIntent: 'transactional' | 'informational' | null;
  /** Share of results with a recognised format. */
  coverage: number;
  counts: Partial<Record<SerpFormat, number>>;
}

const INTENT: Partial<Record<SerpFormat, 'transactional' | 'informational'>> = {
  product: 'transactional', category: 'transactional', guide: 'informational', encyclopedia: 'informational', listicle: 'informational',
};

export const summarizeSerpFormats = (urls: readonly string[]): FormatSummary => {
  const counts: Partial<Record<SerpFormat, number>> = {};
  urls.forEach((url) => {
    const format = classifySerpUrl(url);
    if (format) counts[format] = (counts[format] ?? 0) + 1;
  });
  const classified = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const coverage = urls.length ? classified / urls.length : 0;
  const ranked = (Object.entries(counts) as Array<[SerpFormat, number]>).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [top, second] = ranked;
  const dominant = top && coverage >= FORMAT_MIN_COVERAGE && top[1] / classified > FORMAT_MAJORITY && (!second || top[1] > second[1]) ? top[0] : null;
  return { dominantFormat: dominant, dominantIntent: dominant ? INTENT[dominant] ?? null : null, coverage, counts };
};
