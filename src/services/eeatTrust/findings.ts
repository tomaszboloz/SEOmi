import type { AuthorEntity, CitationDetail, SchemaGraphDetail, TransparencyDetail, TrustFinding, TrustLevel, TrustSeverity, YmylCategory } from './types';

export const TRUST_CODES = {
  finding: [
    'ymyl-unattributed', 'ymyl-no-reviewer', 'no-bylines', 'generic-author', 'org-missing', 'org-no-same-as', 'author-no-same-as',
    'author-no-id', 'author-off-topic', 'low-citations', 'dead-citations', 'missing-editorial', 'missing-contact', 'missing-registry',
    'missing-about', 'missing-dates', 'no-articles', 'author-invalid-profile', 'ymyl-no-scholarly-ids',
  ],
  level: ['strong', 'adequate', 'weak', 'critical'],
  ymyl: ['health', 'finance', 'legal'],
} as const;

const OFF_TOPIC_BELOW = 40;
const MIN_TRUSTED_SHARE = 0.3;
const MIN_DATED_SHARE = 0.5;

export const levelFor = (score: number): TrustLevel => (score >= 75 ? 'strong' : score >= 60 ? 'adequate' : score >= 40 ? 'weak' : 'critical');

const pct = (part: number, whole: number): number => (whole ? Math.round((part / whole) * 100) : 0);

export interface FindingInput {
  schema: SchemaGraphDetail;
  authors: AuthorEntity[];
  citations: CitationDetail;
  transparency: TransparencyDetail;
  ymyl?: YmylCategory;
  unattributed: number;
}

/** Ordered action list: YMYL attribution first, then entity graph, citations and trust pages. */
export const buildFindings = (input: FindingInput): TrustFinding[] => {
  const { schema, authors, citations, transparency, ymyl, unattributed } = input;
  const out: TrustFinding[] = [];
  const add = (severity: TrustSeverity, code: string, params: Record<string, number | string> = {}): void => { out.push({ severity, code, params }); };
  const articles = schema.articleCount;
  const named = authors.filter((author) => !author.generic);
  const generic = authors.filter((author) => author.generic).reduce((sum, author) => sum + author.articleUrls.length, 0);
  if (!articles) add('info', 'no-articles');
  if (ymyl && articles && unattributed) add('critical', 'ymyl-unattributed', { count: unattributed, pct: pct(unattributed, articles) });
  if (ymyl === 'health' && articles && !schema.articlesWithReviewer) add('critical', 'ymyl-no-reviewer', { count: articles });
  if (articles && !schema.articlesWithAuthor) add('warning', 'no-bylines', { count: articles });
  if (generic) add('warning', 'generic-author', { count: generic });
  if (!schema.organization.present) add('warning', 'org-missing');
  else if (!schema.organization.sameAs.length) add('warning', 'org-no-same-as', { name: schema.organization.name ?? '' });
  const noSameAs = named.filter((author) => !author.sameAs.length);
  if (noSameAs.length) add('warning', 'author-no-same-as', { count: noSameAs.length, names: noSameAs.slice(0, 3).map((author) => author.name).join(', ') });
  const invalid = named.filter((author) => author.profiles.some((profile) => profile.status === 'invalid' && profile.tier === 1));
  if (invalid.length) add('warning', 'author-invalid-profile', { count: invalid.length, names: invalid.slice(0, 3).map((author) => author.name).join(', ') });
  const noId = named.filter((author) => !author.id);
  if (noId.length) add('info', 'author-no-id', { count: noId.length });
  for (const author of named.filter((item) => item.alignmentPct !== undefined && item.alignmentPct < OFF_TOPIC_BELOW).slice(0, 3)) {
    add('warning', 'author-off-topic', { name: author.name, pct: author.alignmentPct ?? 0 });
  }
  if (citations.pagesAnalyzed && citations.pagesWithTrusted / citations.pagesAnalyzed < MIN_TRUSTED_SHARE) {
    add('warning', 'low-citations', { pct: pct(citations.pagesWithTrusted, citations.pagesAnalyzed), pages: citations.pagesAnalyzed });
  }
  if (ymyl && citations.pagesAnalyzed && !citations.scholarlySources) add('info', 'ymyl-no-scholarly-ids', { pages: citations.pagesAnalyzed });
  if (citations.deadLinks.length) add('warning', 'dead-citations', { count: citations.deadLinks.length });
  if (!transparency.found.editorial) add('warning', 'missing-editorial');
  if (!transparency.found.contact) add('warning', 'missing-contact');
  if (!transparency.found.registry) add('info', 'missing-registry');
  if (!transparency.found.about) add('info', 'missing-about');
  if (articles && transparency.datedArticles / articles < MIN_DATED_SHARE) add('warning', 'missing-dates', { pct: pct(transparency.datedArticles, articles) });
  const rank = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
};
