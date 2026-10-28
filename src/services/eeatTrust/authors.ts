import type { CrawledPageSummary } from '@/types';
import type { FocusPage, SiteFocusReport } from '@/services/siteFocus';
import { normalizeUrl } from '@/services/siteFocus/pageType';
import { phraseKey } from '@/services/siteFocus/terms';
import { childNodes, type SchemaNode } from './graph';
import { sameName } from './identityMatch';
import { classifyProfiles, declarationRecall, reconciliationStatus } from './identifiers';
import type { AuthorEntity, ProfileEvidence } from './types';

const GENERIC = /^(the\s+)?(redakcj|redaktion|redacci|redazion|r[eé]daction|editorial|editors?\b|staff\b|admin|team\b|zesp[oó]ł|zespol|команд|редакц|администр|autor\b|author\b|unknown|anonim)/i;
const ID_LIKE = /^(https?:\/\/|#|\/)/;
const BIO_TERMS = 40;

/** A site-root id such as https://site/#person names the entity, not a profile page. */
const isRootUrl = (url: string): boolean => { try { return new URL(url).pathname === '/'; } catch { return false; } };

/** Name and alias of a non-generic entity travel with each profile so a fetched registry body can be compared. */
const withSubjects = (profiles: ProfileEvidence[], entity: SchemaNode): ProfileEvidence[] => {
  const subjects = [entity.name, ...(entity.props.alternateName ?? [])].filter((name): name is string => Boolean(name?.trim()) && !isGenericAuthor(name ?? ''));
  return subjects.length ? profiles.map((profile) => ({ ...profile, subjects })) : profiles;
};

export const isGenericAuthor = (name: string): boolean => GENERIC.test(name.trim());

/** Entities named by `property` of an article node: referenced by id/name or declared inline. */
export const resolveEntities = (node: SchemaNode, property: string, siblings: SchemaNode[], registry: Map<string, SchemaNode>): SchemaNode[] => {
  const found: SchemaNode[] = [];
  for (const value of (node.props[property] ?? []).filter((item) => item.trim())) {
    const known = registry.get(value);
    if (known) found.push(known);
    else if (ID_LIKE.test(value)) found.push({ ...node, id: value, types: ['Person'], name: undefined, props: {} });
    else found.push({ ...node, id: undefined, types: ['Person'], name: value, props: {} });
  }
  for (const child of childNodes(node, property, siblings)) found.push((child.id && registry.get(child.id)) || child);
  return found;
};

const entityKey = (entity: SchemaNode): string => (entity.id ?? entity.name ?? '').trim().toLowerCase();

/** Share (0-100) of the author's declared expertise that lies inside the Core Topic; undefined without bio signal. */
const alignmentOf = (entity: SchemaNode, pages: CrawledPageSummary[], report: SiteFocusReport | undefined, articles: Set<string>): number | undefined => {
  if (!report) return undefined;
  const language = report.model.language;
  const weights = new Map<string, number>();
  const add = (key: string | null | undefined, weight: number): void => { if (key) weights.set(key, (weights.get(key) ?? 0) + weight); };
  const bio = [...(entity.props.bio ?? []), ...(entity.props.description ?? [])];
  const credentials = entity.props.hasCredential ?? entity.props.credential ?? [];
  const declared = [...bio, ...credentials, ...(entity.props.knowsAbout ?? [])];
  // A jobTitle by itself is not a competence claim. It can add signal only
  // when the crawl also exposes an explicit bio, credential or knowsAbout.
  if (declared.length) [...(entity.props.jobTitle ?? []), ...declared].forEach((text) => {
    add(phraseKey(text, language), 1);
    text.split(/[\s,;/]+/).forEach((word) => add(phraseKey(word, language), 0.5));
  });
  const urls = new Set([entity.id, ...(entity.props.url ?? [])].filter((url): url is string => Boolean(url) && !isRootUrl(String(url))).map((url) => normalizeUrl(url.split('#')[0])));
  const pageUrl = (page: CrawledPageSummary): string => page.final_url || page.url;
  // No profile URL in the graph: an author page is a non-article page whose h1 or title carries the byline name.
  const named = (page: FocusPage): boolean => Boolean(entity.name) && !articles.has(pageUrl(page))
    && [...(page.heading_texts?.h1 ?? []), page.title ?? ''].some((text) => sameName(entity.name ?? '', text.replace(/\s*[-|–].*$/, '')));
  const profile = (pages.find((page) => urls.has(normalizeUrl(pageUrl(page)))) ?? pages.find((page) => named(page as FocusPage))) as FocusPage | undefined;
  [...(profile?.focus_terms ?? [])].sort((a, b) => b.weight - a.weight).slice(0, BIO_TERMS).forEach((term) => add(term.term, term.weight));
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  if (!total) return undefined;
  const inCore = [...weights].reduce((sum, [key, weight]) => sum + (key in report.model.coreWeights ? weight : 0), 0);
  return Math.round((inCore / total) * 100);
};

export interface AuthorScan { authors: AuthorEntity[]; withAuthor: Set<string>; withReviewer: Set<string> }

/** Bylines of every article page, merged by entity; also which pages name an author or a reviewer. */
export const scanAuthors = (
  pages: CrawledPageSummary[],
  nodesByPage: Map<string, SchemaNode[]>,
  articleNodes: Map<string, SchemaNode[]>,
  registry: Map<string, SchemaNode>,
  report: SiteFocusReport | undefined,
): AuthorScan => {
  const articleUrlSet = new Set(articleNodes.keys());
  const byKey = new Map<string, AuthorEntity>();
  const withAuthor = new Set<string>();
  const withReviewer = new Set<string>();
  for (const [url, articles] of articleNodes) {
    const siblings = nodesByPage.get(url) ?? [];
    for (const article of articles) {
      if (resolveEntities(article, 'reviewedBy', siblings, registry).length) withReviewer.add(url);
      for (const entity of resolveEntities(article, 'author', siblings, registry)) {
        const key = entityKey(entity);
        if (!key) continue;
        withAuthor.add(url);
        const author = byKey.get(key) ?? {
          key, name: entity.name ?? entity.id ?? key, id: entity.id, jobTitle: entity.props.jobTitle?.[0],
          bio: [...(entity.props.bio ?? []), ...(entity.props.description ?? [])].join(' ') || undefined,
          credentials: entity.props.hasCredential ?? entity.props.credential ?? [],
          knowsAbout: entity.props.knowsAbout ?? [],
          sameAs: entity.props.sameAs ?? [],
          profiles: withSubjects(classifyProfiles(entity.props.sameAs ?? []), entity), articleUrls: [], generic: isGenericAuthor(entity.name ?? ''),
          alignmentPct: alignmentOf(entity, pages, report, articleUrlSet),
        };
        author.reconciliation = {
          role: 'author', profiles: author.profiles, declarationRecall: declarationRecall(author.profiles),
          status: reconciliationStatus(author.profiles),
          evidence: 'declared',
        };
        if (!author.articleUrls.includes(url)) author.articleUrls.push(url);
        byKey.set(key, author);
      }
    }
  }
  const authors = [...byKey.values()].sort((a, b) => b.articleUrls.length - a.articleUrls.length || a.name.localeCompare(b.name));
  return { authors, withAuthor, withReviewer };
};
