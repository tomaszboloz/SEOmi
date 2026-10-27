import { serializeJsonLd } from '@/services/schemaGenerator/composition';
import type { AuthorEntity, TrustReport, YmylCategory } from './types';

export interface TrustJsonLdInput {
  personName: string;
  jobTitle?: string;
  personUrl?: string;
  sameAs: string[];
  organizationName?: string;
  organizationUrl: string;
  organizationSameAs?: string[];
  pageUrl: string;
  pageName?: string;
  category?: YmylCategory;
  dateModified?: string;
  lastReviewed?: string;
  /** When true the person is declared as medical/legal reviewer instead of author. */
  asReviewer?: boolean;
}

export type JsonLdIssue = 'missing-name' | 'invalid-organization-url' | 'invalid-page-url' | 'invalid-same-as';

export interface TrustJsonLd { ok: boolean; graph: Record<string, unknown>; text: string; issues: JsonLdIssue[] }

/** Single serializer shared with schema composition, so both exports escape the same way. */
export const safeJsonLdText = serializeJsonLd;

const web = (value: string | undefined): string | undefined => {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch { return undefined; }
};

const slug = (text: string): string => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'person';

const PAGE_TYPE: Record<YmylCategory, string> = { health: 'MedicalWebPage', finance: 'WebPage', legal: 'WebPage' };

/** Validated schema.org graph: Organization, Person (with sameAs) and a page that names them as author or reviewer. */
export const buildTrustJsonLd = (input: TrustJsonLdInput): TrustJsonLd => {
  const issues: JsonLdIssue[] = [];
  const name = input.personName.trim();
  const org = web(input.organizationUrl);
  const page = web(input.pageUrl);
  if (!name) issues.push('missing-name');
  if (!org) issues.push('invalid-organization-url');
  if (!page) issues.push('invalid-page-url');
  const sameAs = input.sameAs.map((item) => item.trim()).filter(Boolean);
  const validSameAs = sameAs.map(web).filter((item): item is string => Boolean(item));
  if (validSameAs.length !== sameAs.length) issues.push('invalid-same-as');
  const origin = org ? new URL(org).origin : '';
  const orgId = `${origin}/#organization`;
  const personId = web(input.personUrl) ? `${new URL(web(input.personUrl) as string).href.split('#')[0]}#person` : `${origin}/#${slug(name)}`;
  const organization = {
    '@type': 'Organization', '@id': orgId, name: input.organizationName?.trim() || undefined, url: org,
    ...(input.organizationSameAs?.length ? { sameAs: input.organizationSameAs.map(web).filter(Boolean) } : {}),
  };
  const person = {
    '@type': 'Person', '@id': personId, name, jobTitle: input.jobTitle?.trim() || undefined,
    url: web(input.personUrl), sameAs: validSameAs.length ? validSameAs : undefined, worksFor: { '@id': orgId },
  };
  const webPage = {
    '@type': input.category ? PAGE_TYPE[input.category] : 'WebPage', '@id': `${page ?? ''}#webpage`, url: page, name: input.pageName?.trim() || undefined,
    [input.asReviewer ? 'reviewedBy' : 'author']: { '@id': personId }, publisher: { '@id': orgId },
    dateModified: input.dateModified || undefined, lastReviewed: input.lastReviewed || undefined,
  };
  const graph = { '@context': 'https://schema.org', '@graph': [organization, person, webPage] };
  const text = safeJsonLdText(graph);
  return { ok: issues.filter((issue) => issue !== 'invalid-same-as').length === 0, graph, text, issues };
};

/** Form defaults for an author found in the crawl, so the generator starts from real data. */
export const prefillFromAuthor = (author: AuthorEntity, report: TrustReport, startUrl: string): TrustJsonLdInput => ({
  personName: author.generic ? '' : author.name,
  jobTitle: author.jobTitle,
  personUrl: author.id && /^https?:/.test(author.id) ? author.id.split('#')[0] : undefined,
  sameAs: author.sameAs,
  organizationName: report.schema.organization.name,
  organizationUrl: startUrl,
  organizationSameAs: report.schema.organization.sameAs,
  pageUrl: author.articleUrls[0] ?? startUrl,
  category: report.ymyl,
  asReviewer: false,
});
