import type { FocusPage } from '@/services/siteFocus';
import { createCrawlPageFixture } from './fixtures/crawl';

export const DIABETES_TERMS = [
  'diabetes', 'insulin', 'glucose', 'blood sugar', 'hba1c', 'carbohydrate', 'glycemic index', 'type 2', 'neuropathy', 'metformin',
  'diet', 'pancreas', 'insulin resistance', 'hypoglycemia', 'glucose meter', 'complications', 'retinopathy', 'blood pressure',
  'cholesterol', 'exercise', 'weight loss', 'fasting glucose', 'insulin pump', 'symptoms', 'diagnosis', 'treatment', 'kidney',
  'foot care', 'ketones', 'sugar',
];
export const PHONE_TERMS = ['smartphone', 'battery', 'camera', 'display', 'processor', 'android', '5g', 'screen', 'charging', 'storage', 'chipset', 'lens'];
export const PRIVACY_TERMS = ['privacy', 'cookies', 'policy', 'personal data', 'consent', 'controller', 'rights', 'retention'];

export interface PageSpec { path: string; title: string; terms: Array<[string, number]>; patch?: Partial<FocusPage> }

export const makePage = (host: string, spec: PageSpec): FocusPage => createCrawlPageFixture({
  url: `https://${host}${spec.path}`, final_url: `https://${host}${spec.path}`, title: spec.title, word_count: 900,
  document_language: 'en', depth: spec.path.split('/').filter(Boolean).length,
  focus_terms: spec.terms.map(([term, count]) => ({ term, surface: term, count, weight: count * 2 })),
  ...spec.patch,
}) as FocusPage;

const rotate = (pool: string[], start: number, size: number): Array<[string, number]> =>
  Array.from({ length: size }, (_, j): [string, number] => [pool[(start + j) % pool.length], 2 + ((start + j) % 4)]);

/** `count` on-topic articles that each use a rotating half of the vocabulary plus unique words. */
export const topicArticles = (host: string, prefix: string, pool: string[], count: number, size = 16): FocusPage[] =>
  Array.from({ length: count }, (_, i) => makePage(host, {
    path: `${prefix}/article-${i}`, title: `${pool[i % pool.length]} guide ${i}`,
    terms: [...rotate(pool, i * 3, size), [`unique${prefix.replace(/\W/g, '')}${i} word${i}`, 1]],
  }));

export const diabetesSite = (host = 'diabetes.test'): FocusPage[] => [
  makePage(host, { path: '/', title: 'Diabetes care', terms: rotate(DIABETES_TERMS, 0, 24) }),
  makePage(host, {
    path: '/category/diabetes-care', title: 'Diabetes care category', terms: rotate(DIABETES_TERMS, 5, 20),
    // A category leads from its own content to its articles.
    patch: { semantic_links: Array.from({ length: 4 }, (_, i) => ({ target_url: `https://${host}/articles/article-${i}`, anchor_text: `Article ${i}`, is_internal: true })) },
  }),
  ...topicArticles(host, '/articles', DIABETES_TERMS, 24),
  makePage(host, { path: '/phones/review-1', title: 'Best smartphone review', terms: rotate(PHONE_TERMS, 0, 10) }),
  makePage(host, { path: '/phones/review-2', title: 'Smartphone camera test', terms: rotate(PHONE_TERMS, 3, 10) }),
  makePage(host, { path: '/phones/review-3', title: 'Smartphone battery life', terms: rotate(PHONE_TERMS, 6, 10) }),
  makePage(host, { path: '/privacy-policy', title: 'Privacy policy', terms: rotate(PRIVACY_TERMS, 0, 8) }),
];

export const ELECTRONICS = ['laptop', 'processor', 'monitor', 'keyboard', 'headphones', 'router', 'usb', 'bluetooth', 'speaker', 'camera', 'tablet', 'charger'];
export const FASHION = ['dress', 'jacket', 'sneakers', 'denim', 'fabric', 'wardrobe', 'collection', 'tailoring', 'silk', 'leather', 'scarf', 'runway'];
export const HOME = ['sofa', 'kitchen', 'lamp', 'carpet', 'furniture', 'bedroom', 'curtains', 'shelf', 'garden', 'decor', 'mattress', 'paint'];

/** Three equally sized topics, each living under its own first URL segment. */
export const multiTopicSite = (host = 'shop.test', perTopic = 10): FocusPage[] => [
  ...topicArticles(host, '/electronics', ELECTRONICS, perTopic, 8),
  ...topicArticles(host, '/fashion', FASHION, perTopic, 8),
  ...topicArticles(host, '/home', HOME, perTopic, 8),
];

/** Legacy page: no focus_terms, only the bounded semantic data older crawls stored. */
export const legacyPage = (host: string, path: string, title: string, terms: string[], patch: Partial<FocusPage> = {}): FocusPage =>
  createCrawlPageFixture({
    url: `https://${host}${path}`, final_url: `https://${host}${path}`, title, semantic_terms: terms, word_count: 600,
    document_language: 'en', ...patch,
  }) as FocusPage;
