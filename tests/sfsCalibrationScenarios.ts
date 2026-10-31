import type { CalibrationSite, ManualLabel } from '@/services/siteFocusCalibration';
import type { FocusPage } from '@/services/siteFocus';
import { DIABETES_TERMS, ELECTRONICS, PHONE_TERMS, diabetesSite, makePage, multiTopicSite, topicArticles } from './siteFocusFixtures';

/**
 * Synthetic scenario corpus for the #52 harness (GEM-52-T02/T03). One site per corpus kind the issue
 * asks for, with manual labels. These fixtures test the harness and engine behaviour only; they are
 * not calibration evidence and never stand in for real, consented crawls (GEM-52-D02).
 */
const provenance = { source: 'synthetic scenario fixture', consent: true, crawledAt: '2026-10-30' };

const OFFER = ['smartphone repair', 'battery replacement', 'screen replacement', 'repair service', 'warranty', 'diagnostics', 'water damage', 'charging port'];
const rotate = (pool: string[], start: number, size: number): Array<[string, number]> =>
  Array.from({ length: size }, (_, j): [string, number] => [pool[(start + j) % pool.length], 3 + ((start + j) % 3)]);

/** A repair shop: home and three offer pages, plus a 30-post blog on an unrelated health topic. */
export const offerBlogSite = (host = 'offer.test'): FocusPage[] => [
  makePage(host, { path: '/', title: 'Phone repair', terms: [...rotate(OFFER, 0, 6), ...rotate(PHONE_TERMS, 0, 4)] }),
  ...[0, 1, 2].map((i) => makePage(host, { path: `/offer/service-${i}`, title: `Service ${i}`, terms: [...rotate(OFFER, i * 2, 5), ...rotate(PHONE_TERMS, i, 3)] })),
  ...Array.from({ length: 30 }, (_, i) => makePage(host, { path: `/blog/post-${i}`, title: `Post ${i}`, terms: rotate(DIABETES_TERMS, i, 14) })),
];

/** "Jaguar" in two senses: a car dealer with a few wildlife posts that share the brand word. */
export const polysemySite = (host = 'jaguar.test'): FocusPage[] => {
  const cars = ['jaguar', 'sedan', 'engine', 'test drive', 'dealer', 'financing', 'horsepower', 'leasing', 'service plan', 'suv'];
  const wildlife = ['jaguar', 'rainforest', 'predator', 'habitat', 'conservation', 'prey', 'amazon', 'species'];
  return [
    ...topicArticles(host, '/models', cars, 14, 8),
    ...Array.from({ length: 4 }, (_, i) => makePage(host, { path: `/wild/jaguar-${i}`, title: `Jaguar ${i}`, terms: rotate(wildlife, i, 7) })),
  ];
};

/** A small niche shop with fewer pages than the low-confidence floor, plus technical pages. */
export const nicheSite = (host = 'niche.test'): FocusPage[] => [
  ...topicArticles(host, '/products', ELECTRONICS.slice(0, 8), 6, 6),
  makePage(host, { path: '/privacy-policy', title: 'Privacy policy', terms: [['privacy', 4], ['cookies', 3], ['consent', 3]] }),
  makePage(host, { path: '/terms', title: 'Terms of service', terms: [['terms', 4], ['liability', 3], ['agreement', 3]] }),
];

/** A crawl whose pages carry no terms at all: the report must be unavailable, never 0 (GEM-52-T03). */
export const emptyCorpusSite = (host = 'empty.test'): FocusPage[] =>
  Array.from({ length: 5 }, (_, i) => makePage(host, { path: `/p/${i}`, title: '', terms: [], patch: { semantic_terms: [], semantic_excerpts: [], word_count: 0 } }));

const label = (pages: FocusPage[], rule: (url: string) => ManualLabel): Record<string, ManualLabel> =>
  Object.fromEntries(pages.map((page) => [page.url, rule(page.url)]));

const site = (id: string, kind: CalibrationSite['kind'], startUrl: string, pages: FocusPage[], rule?: (url: string) => ManualLabel, options: CalibrationSite['options'] = {}): CalibrationSite => ({
  id, kind, startUrl, pages, provenance, options: { language: 'en', ...options }, ...(rule ? { labels: label(pages, rule) } : {}),
});

export const scenarioCorpus = (): CalibrationSite[] => [
  site('niche', 'niche', 'https://niche.test/', nicheSite(), (url) => (/privacy|terms/.test(url) ? 'off-topic' : 'on-topic')),
  site('offer-blog', 'offer-blog', 'https://offer.test/', offerBlogSite(), (url) => (url.includes('/blog/') ? 'off-topic' : 'on-topic'),
    { anchorUrls: ['https://offer.test/offer/service-0', 'https://offer.test/offer/service-1'] }),
  site('ecommerce', 'ecommerce', 'https://diabetes.test/', diabetesSite(), (url) => (/phones|privacy/.test(url) ? 'off-topic' : 'on-topic')),
  site('portal', 'multi-topic', 'https://shop.test/', multiTopicSite()),
  site('jaguar', 'polysemy', 'https://jaguar.test/', polysemySite(), (url) => (url.includes('/wild/') ? 'off-topic' : 'on-topic')),
];
