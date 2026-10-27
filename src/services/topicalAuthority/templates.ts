import { pathSegments } from '@/services/siteFocus/pageType';
import { cosine, type AuthorityPage } from './context';

export const TEMPLATE_MIN_GROUP = 5;
export const TEMPLATE_COSINE = 0.9;

/** Slug without its last word plus the parent path: `/diet-warsaw` and `/diet-krakow` share `diet`. */
const templateKey = (url: string): string => {
  const segments = pathSegments(url);
  const last = segments[segments.length - 1] ?? '';
  const words = last.split('-');
  return words.length >= 2 ? `${segments.slice(0, -1).join('/')}|${words.slice(0, -1).join('-')}` : '';
};

export interface TemplateSplit { representatives: AuthorityPage[]; duplicates: string[] }

/**
 * Programmatic SEO guard: pages built from one template (same slug stem, near-identical vectors) collapse to the
 * strongest page, so hundreds of clones cannot inflate coverage. The clones are reported as crawl-budget waste.
 */
export const splitTemplates = (pages: AuthorityPage[]): TemplateSplit => {
  const buckets = new Map<string, AuthorityPage[]>();
  pages.forEach((entry) => {
    const key = templateKey(entry.url);
    if (key) buckets.set(key, [...(buckets.get(key) ?? []), entry]);
  });
  const dropped = new Set<string>();
  buckets.forEach((members) => {
    if (members.length < TEMPLATE_MIN_GROUP) return;
    const ordered = [...members].sort((a, b) => b.focus.trs - a.focus.trs || (a.url < b.url ? -1 : 1));
    const [rep, ...rest] = ordered;
    rest.filter((entry) => cosine(entry.vector, rep.vector) >= TEMPLATE_COSINE).forEach((entry) => dropped.add(entry.url));
  });
  return { representatives: pages.filter((entry) => !dropped.has(entry.url)), duplicates: [...dropped].sort() };
};
