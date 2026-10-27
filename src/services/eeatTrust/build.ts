import type { CrawledPageSummary } from '@/types';
import type { SiteFocusReport } from '@/services/siteFocus';
import { normalizeUrl } from '@/services/siteFocus/pageType';
import { scanAuthors } from './authors';
import { analyzeCitations, citationScore } from './citations';
import { buildFindings, levelFor } from './findings';
import { buildRegistry, isArticleNode, nodesOf, type SchemaNode } from './graph';
import { analyzeSchema, schemaScore } from './schemaScore';
import { analyzeTransparency, transparencyScore } from './transparency';
import { EEAT_TRUST_VERSION, LEGACY_TRUST_WEIGHTS, TRUST_PROFILE_ID, TRUST_WEIGHTS, type ProfileEvidence, type TrustLayer, type TrustReport } from './types';
import { detectYmyl } from './ymyl';
import { declarationRecall } from './identifiers';

export interface TrustOptions { now?: string; profileEvidence?: Record<string, ProfileEvidence> }

const usable = (page: CrawledPageSummary): boolean => page.http_status < 400 && !page.request_error_kind;

/** Weighted mean of the layers that have data; the others are dropped and weights renormalized. */
export const combineLayers = (layers: Partial<Record<TrustLayer, number>>, weights?: Record<string, number>): number => {
  const profile: Record<string, number> = weights ?? (layers.sameAs === undefined ? LEGACY_TRUST_WEIGHTS : TRUST_WEIGHTS);
  const present = Object.keys(profile).filter((layer): layer is TrustLayer => layers[layer as TrustLayer] !== undefined);
  const total = present.reduce((sum, layer) => sum + profile[layer], 0);
  return total ? Math.round(present.reduce((sum, layer) => sum + (layers[layer] ?? 0) * profile[layer], 0) / total) : 0;
};

const coverage = (score: number | undefined, declared: number, verified = 0) => ({
  observed: score === undefined ? 0 : 100, declared: declared ? 100 : 0, verified, unknown: score === undefined ? 100 : 0,
});

/** Surface a warning before a positive registry result when profiles conflict. */
const reconciliationStatus = (profiles: ProfileEvidence[]): ProfileEvidence['status'] | 'unavailable' => {
  const priorities: Array<ProfileEvidence['status']> = ['mismatch', 'invalid', 'verified', 'fetched', 'syntax-valid', 'declared', 'unavailable'];
  return priorities.find((status) => profiles.some((profile) => profile.status === status)) ?? 'unavailable';
};

/** E-E-A-T & Entity Trust report from the crawl's own schema, links and pages; the Site Focus report supplies Core Topic and page types. */
export const buildTrustReport = (pages: CrawledPageSummary[], focus?: SiteFocusReport, options: TrustOptions = {}): TrustReport => {
  const live = pages.filter(usable);
  const nodesByPage = new Map<string, SchemaNode[]>(live.map((page) => [page.final_url || page.url, nodesOf(page)]));
  const allNodes = [...nodesByPage.values()].flat();
  const registry = buildRegistry(allNodes);
  const focusArticles = new Set((focus?.pages ?? []).filter((page) => page.type === 'article' && !page.skipped).map((page) => normalizeUrl(page.url)));
  const articleNodes = new Map<string, SchemaNode[]>();
  for (const page of live) {
    const url = page.final_url || page.url;
    const own = (nodesByPage.get(url) ?? []).filter(isArticleNode);
    const typed = (nodesByPage.get(url) ?? []).some((node) => node.types.some((type) => /Article|BlogPosting|MedicalWebPage|NewsMedia/i.test(type)));
    if (focusArticles.has(normalizeUrl(url)) || typed) articleNodes.set(url, own);
  }
  const scan = scanAuthors(live, nodesByPage, articleNodes, registry, focus);
  if (options.profileEvidence) scan.authors.forEach((author) => {
    author.profiles = author.profiles.map((profile) => options.profileEvidence?.[profile.url] ?? profile);
    author.reconciliation = {
      role: 'author', profiles: author.profiles, declarationRecall: declarationRecall(author.profiles),
      status: reconciliationStatus(author.profiles), evidence: 'registry',
    };
  });
  const articleUrls = new Set(articleNodes.keys());
  const cited = new Map<string, string[]>([...articleNodes].map(([url, list]) => [url, list.flatMap((node) => node.props.citation ?? [])]));
  const citations = analyzeCitations(live, articleUrls, cited);
  const transparency = analyzeTransparency(live, articleNodes);
  const titles = live.filter((page) => articleUrls.has(page.final_url || page.url)).map((page) => page.title ?? '');
  const ymyl = detectYmyl(allNodes, focus, titles);
  const schema = analyzeSchema(allNodes, articleNodes, scan.authors, scan.withAuthor, scan.withReviewer);

  const named = scan.authors.filter((author) => !author.generic);
  const attributed = new Set([...named.flatMap((author) => author.articleUrls), ...scan.withReviewer]);
  const unattributed = articleUrls.size - [...articleUrls].filter((url) => attributed.has(url)).length;
  const alignmentSum = [...articleUrls].reduce((sum, url) => sum + Math.max(0, ...named.filter((author) => author.articleUrls.includes(url)).map((author) => author.alignmentPct ?? 0)), 0);

  const sameAsLinks = schema.organization.sameAs.length + named.reduce((sum, author) => sum + author.sameAs.length, 0);
  const entityCount = named.length + (schema.organization.present ? 1 : 0);
  const profileRecall = entityCount ? named.reduce((sum, author) => sum + declarationRecall(author.profiles), 0) / entityCount : 0;
  const verifiedProfiles = named.reduce((sum, author) => sum + author.profiles.filter((profile) => profile.status === 'verified').length, 0);
  const sameAsScore = entityCount ? Math.round((Math.min(1, sameAsLinks / entityCount) * 50 + profileRecall * 50)) : undefined;
  const hasAuthorEvidence = scan.authors.some((author) => author.alignmentPct !== undefined || author.bio || author.credentials?.length || author.knowsAbout?.length);
  const layers: TrustReport['layers'] = {
    ...(allNodes.length ? { schemaGraph: schemaScore(schema, Boolean(ymyl)) } : {}),
    ...(sameAsScore === undefined ? {} : { sameAs: sameAsScore }),
    ...(transparencyScore(transparency) === undefined ? {} : { transparency: transparencyScore(transparency) }),
    ...(focus && articleUrls.size && hasAuthorEvidence ? { authorAlignment: Math.round(alignmentSum / articleUrls.size) } : {}),
    ...(citationScore(citations) !== undefined ? { citationQuality: citationScore(citations) } : {}),
  };
  const authorScore = layers.authorAlignment;
  const citation = layers.citationQuality;
  const ymylTriggered = Boolean(ymyl && (authorScore === 0 || (citation !== undefined && citation < 15)));
  const rawScore = combineLayers(layers, TRUST_WEIGHTS);
  const score = ymylTriggered ? Math.round(rawScore * 0.45) : rawScore;
  const coverageByLayer: TrustReport['coverage'] = {
    schemaGraph: coverage(layers.schemaGraph, schema.articleCount),
    sameAs: coverage(layers.sameAs, sameAsLinks, verifiedProfiles > 0 ? 100 : 0),
    authorAlignment: coverage(layers.authorAlignment, scan.authors.some((author) => author.bio || author.credentials?.length || author.knowsAbout?.length) ? 1 : 0),
    citationQuality: coverage(layers.citationQuality, citations.pagesWithAnyExternal),
    transparency: coverage(layers.transparency, Object.values(transparency.found).filter(Boolean).length),
  };
  return {
    score, level: levelFor(score), layers, profileVersion: EEAT_TRUST_VERSION, profileId: TRUST_PROFILE_ID, coverage: coverageByLayer, ymyl,
    ...(ymyl ? { ymylPolicy: { category: ymyl, applicable: true, multiplier: 0.45, triggered: ymylTriggered, heuristic: true as const } } : {}),
    schema, authors: scan.authors, citations, transparency,
    findings: buildFindings({ schema, authors: scan.authors, citations, transparency, ymyl, unattributed }),
    ymylUnattributedPct: ymyl && articleUrls.size ? Math.round((unattributed / articleUrls.size) * 100) : undefined,
    pageCount: live.length, articleCount: articleUrls.size, generatedAt: options.now ?? new Date().toISOString(), version: EEAT_TRUST_VERSION,
  };
};
