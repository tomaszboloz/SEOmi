import { computeSfs } from './aggregate';
import type { CoreTopic, Effort, PageFocus, PagePlaybook, PlaybookOption, Recommendation, SiteFlags, SubSite, TopicGap } from './types';

export const IMPROVED_BORDERLINE_TRS = 82;
export const NEW_PAGE_TRS = 85;
const MAX_NEW_PAGES = 5;
const MAX_LISTED_URLS = 10;
const round1 = (value: number): number => Math.round(value * 10) / 10;

const effort = (minHours: number, maxHours: number): Effort => ({ minHours: round1(minHours), maxHours: round1(maxHours), estimate: true });
const contentPages = (pages: PageFocus[]): PageFocus[] => pages.filter((page) => !page.skipped && page.type !== 'technical');

/** Delta Score Simulation: SFS after dropping these URLs from the site. */
export const simulateRemoval = (pages: PageFocus[], urls: string[]): number => {
  const gone = new Set(urls);
  return computeSfs(pages.filter((page) => !gone.has(page.url))).score;
};

/** Delta Score Simulation: SFS after lifting these URLs to at least `target` TRS. */
export const simulateImprovement = (pages: PageFocus[], urls: string[], target = IMPROVED_BORDERLINE_TRS): number => {
  const lifted = new Set(urls);
  return computeSfs(pages.map((page) => (lifted.has(page.url) ? { ...page, trs: Math.max(page.trs, target) } : page))).score;
};

const make = (
  code: Recommendation['code'], params: Recommendation['params'], deltaScore: number, cost: Effort, urls: string[] = [],
): Recommendation => ({
  code, params, deltaScore: round1(Math.max(0, deltaScore)), effort: cost, urls,
  ratio: round1(Math.max(0, deltaScore) / ((cost.minHours + cost.maxHours) / 2) * 100) / 100,
});

/** Site-wide actions ranked by simulated gain per estimated effort hour. */
export const buildRecommendations = (
  pages: PageFocus[], score: number, flags: SiteFlags, gaps: TopicGap[], linkCount: number, subSites: SubSite[],
): Recommendation[] => {
  const content = contentPages(pages);
  const worst = (list: PageFocus[]) => [...list].sort((a, b) => a.trs - b.trs || (a.url < b.url ? -1 : 1)).map((page) => page.url);
  const off = content.filter((page) => page.trs < 40);
  // Every page between off-topic (<40) and strong (>=75) gets an action: weak and borderline pages are not left without advice.
  const borderline = content.filter((page) => page.trs >= 40 && page.trs < 75);
  const recs: Recommendation[] = [];
  if (off.length && !flags.isLowConfidence) {
    const gain = simulateRemoval(pages, off.map((page) => page.url)) - score;
    recs.push(make('remove-offtopic', { count: off.length, gain: round1(gain) }, gain, effort(0.25 * off.length, 0.5 * off.length), worst(off).slice(0, MAX_LISTED_URLS)));
  }
  if (flags.isLowConfidence) {
    recs.push(make('collect-more-pages', { pageCount: pages.filter((page) => !page.skipped).length }, 0, effort(2, 8)));
  }
  if (borderline.length) {
    const gain = simulateImprovement(pages, borderline.map((page) => page.url)) - score;
    recs.push(make('strengthen-borderline', { count: borderline.length, gain: round1(gain), target: IMPROVED_BORDERLINE_TRS }, gain, effort(borderline.length, 3 * borderline.length), worst(borderline).slice(0, MAX_LISTED_URLS)));
  }
  const gapCount = Math.min(gaps.filter((gap) => gap.code === 'thin-subtopic').length, MAX_NEW_PAGES);
  if (gapCount) {
    const added = Array.from({ length: gapCount }, (_, i): PageFocus => ({ ...pages[0], url: `new-${i}`, trs: NEW_PAGE_TRS, weight: 1, type: 'article', skipped: undefined }));
    const gain = computeSfs([...pages, ...added]).score - score;
    recs.push(make('expand-core-cluster', { count: gapCount, gain: round1(gain) }, gain, effort(3 * gapCount, 8 * gapCount)));
  }
  if (linkCount) recs.push(make('add-internal-links', { count: linkCount }, 0, effort(0.1 * linkCount, 0.3 * linkCount)));
  if (flags.isMultiTopic) recs.push(make('split-subsites', { count: subSites.length }, 0, effort(2, 6)));
  const skipped = pages.filter((page) => page.skipped);
  if (skipped.length) recs.push(make('review-skipped-pages', { count: skipped.length, timeouts: flags.skippedRenderTimeouts }, 0, effort(0.5, 2), skipped.map((page) => page.url).slice(0, MAX_LISTED_URLS)));
  const strong = content.filter((page) => page.trs >= 75);
  if (strong.length) recs.push(make('monitor-strong-pages', { count: strong.length }, 0, effort(0.5, 1)));
  return recs.sort((a, b) => b.ratio - a.ratio || b.deltaScore - a.deltaScore || (a.code < b.code ? -1 : 1));
};

const option = (code: PlaybookOption['code'], params: PlaybookOption['params'], cost: Effort, expected?: [number, number]): PlaybookOption =>
  ({ code, params, effort: cost, ...(expected ? { expectedTrs: { min: expected[0], max: expected[1], estimate: true as const } } : {}) });

/** Page-level playbook: A (TRS < 40), B (40-74), C (>= 75). All times and scores are estimates. */
export const buildPagePlaybook = (page: PageFocus, pages: PageFocus[], score: number, core: CoreTopic): PagePlaybook => {
  const have = new Set(page.keywordsFound.map((keyword) => keyword.term));
  const missing = core.terms.map((term) => term.term).filter((term) => !have.has(term)).slice(0, 8).join(', ');
  if (page.playbook === 'A') {
    const gain = round1(simulateRemoval(pages, [page.url]) - score);
    return {
      url: page.url, playbook: 'A',
      options: [
        option('remove-redirect', { gain }, effort(0.25, 0.5)),
        option('noindex-isolate', { gain }, effort(0.25, 1)),
        option('rewrite-on-topic', { target: IMPROVED_BORDERLINE_TRS }, effort(2, 6), [70, 85]),
      ],
      steps: [
        { code: 'check-traffic-and-backlinks', params: {} }, { code: 'redirect-301-to-closest-page', params: {} },
        { code: 'remove-internal-links', params: {} }, { code: 'add-noindex', params: {} }, { code: 'rewrite-with-brief', params: { terms: missing } },
      ],
    };
  }
  if (page.playbook === 'B') {
    const lift = (low: number, high: number): [number, number] => [Math.min(95, page.trs + low), Math.min(95, page.trs + high)];
    return {
      url: page.url, playbook: 'B',
      options: [
        option('add-missing-terms', { terms: missing }, effort(0.5, 1.5), lift(5, 12)),
        option('reinforce-headings', {}, effort(0.5, 1), lift(3, 8)),
        option('deepen-coverage', {}, effort(1, 3), lift(8, 20)),
      ],
      steps: [{ code: 'add-terms', params: { terms: missing } }, { code: 'expand-h2-h3', params: {} }, { code: 'add-examples', params: {} }],
    };
  }
  return {
    url: page.url, playbook: 'C',
    options: [option('serve-as-hub', {}, effort(0.5, 2)), option('build-satellite-cluster', {}, effort(3, 8)), option('monitor-periodically', { weeks: 6 }, effort(0.25, 0.5))],
    steps: [{ code: 'link-from-weak-pages', params: {} }, { code: 'plan-satellite-pages', params: {} }, { code: 'recheck-in-six-weeks', params: { weeks: 6 } }],
  };
};
