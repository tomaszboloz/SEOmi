import type { CrawledLink, CrawledPageSummary } from '@/types';
import { scholarlyIds, scholarlyKey } from './citationIds';
import { extractCitationReferences, mapClaimsToCitations, type CitationSource } from '@/services/citationEvidence/claims';
import { claimBackedPageScore, classifySource, firmClaims, pageQuality, pageRBacked, Q_TARGET_DEFAULT, Q_TARGET_YMYL, type SourceClass } from './citationQuality';
import type { CitationDetail, ScoringProfile } from './types';

/** Time-tested seed hosts: public institutions, scholarly publishers and standards bodies. */
const SEED_SUFFIX = /(^|\.)(gov|edu|mil|int)$|\.(gov|edu|ac|go|gouv)\.[a-z]{2}$|\.bund\.de$/i;
const SEED_HOSTS = new Set([
  'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'nih.gov', 'who.int', 'cdc.gov', 'europa.eu', 'ec.europa.eu', 'doi.org', 'dx.doi.org',
  'cochranelibrary.com', 'nature.com', 'sciencedirect.com', 'thelancet.com', 'nejm.org', 'bmj.com', 'jamanetwork.com', 'springer.com',
  'wiley.com', 'oecd.org', 'iso.org', 'w3.org', 'eur-lex.europa.eu', 'isap.sejm.gov.pl', 'orcid.org', 'arxiv.org', 'scholar.google.com',
]);

const SCHOLARLY_KINDS = new Set(['doi', 'pmid', 'pmcid']);
/** DOI / PMID / PMCID written in the page text (bibliography, inline notes), not only in link targets. */
const textScholarlyKeys = (page: CrawledPageSummary): string[] => extractCitationReferences(
  [...(page.semantic_excerpts ?? []), ...(page.rag_sections ?? []).flatMap((section) => section.paragraphs)].join('\n'),
).flatMap((ref) => (ref.key && SCHOLARLY_KINDS.has(ref.kind) ? [ref.key] : []));

const hostOf = (url: string): string => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };

export const isTrustedHost = (host: string): boolean => Boolean(host) && (SEED_SUFFIX.test(host) || [...SEED_HOSTS].some((seed) => host === seed || host.endsWith(`.${seed}`)));
export const isDeadLink = (link: CrawledLink): boolean => Boolean(link.target_request_error_kind) || (link.target_http_status !== undefined && link.target_http_status >= 400);

/** Outbound citation quality for the given article pages (external links only). */
export const analyzeCitations = (pages: CrawledPageSummary[], articleUrls: Set<string>, citedBySchema: Map<string, string[]>): CitationDetail => {
  const detail: CitationDetail = { pagesAnalyzed: 0, pagesWithTrusted: 0, pagesWithAnyExternal: 0, trustedLinks: 0, externalLinks: 0, checkedLinks: 0, deadLinks: [], pagesWithScholarly: 0, scholarlySources: 0, claimEvidence: [], unbackedHighStakesClaims: 0, pageQuality: [], claimCount: 0 };
  const sources = new Set<string>();
  for (const page of pages) {
    const url = page.final_url || page.url;
    if (!articleUrls.has(url)) continue;
    detail.pagesAnalyzed += 1;
    const external = page.links.filter((link) => !link.is_internal);
    const targets = new Set([...external.map((link) => link.target_url), ...(citedBySchema.get(url) ?? [])]);
    const sourceCatalog = [...targets].map((target): CitationSource | null => {
      const id = scholarlyKey(scholarlyIds(target));
      const link = external.find((item) => item.target_url === target);
      return id ? { key: id, exists: true, reachable: link?.target_http_status === undefined ? undefined : link.target_http_status < 400 } : null;
    }).filter((item): item is CitationSource => Boolean(item));
    const claims = mapClaimsToCitations((page.semantic_excerpts ?? []).join(' '), sourceCatalog);
    detail.claimEvidence?.push(...claims.map((claim) => ({ ...claim, claim: `${url}: ${claim.claim}` })));
    detail.unbackedHighStakesClaims = (detail.unbackedHighStakesClaims ?? 0) + claims.filter((claim) => claim.relation === 'unmatched').length;
    const trusted = [...targets].filter((target) => isTrustedHost(hostOf(target)));
    const classes = new Map<string, SourceClass>();
    for (const target of targets) {
      const link = external.find((item) => item.target_url === target);
      classes.set(scholarlyKey(scholarlyIds(target)) ?? target, classifySource(target, isTrustedHost(hostOf(target)), Boolean(link && isDeadLink(link))));
    }
    detail.pageQuality?.push(pageQuality(url, [...classes.values()], claims));
    detail.claimCount = (detail.claimCount ?? 0) + firmClaims(claims).length;
    if (targets.size) detail.pagesWithAnyExternal += 1;
    if (trusted.length) detail.pagesWithTrusted += 1;
    const linked = [...targets].map((target) => scholarlyKey(scholarlyIds(target))).filter((key): key is string => Boolean(key));
    const keys = [...new Set([...linked, ...textScholarlyKeys(page)])];
    if (keys.length) detail.pagesWithScholarly += 1;
    keys.forEach((key) => sources.add(key));
    detail.externalLinks += external.length;
    detail.trustedLinks += trusted.length;
    for (const link of external) {
      if (link.target_http_status === undefined && !link.target_request_error_kind) continue;
      detail.checkedLinks += 1;
      if (isDeadLink(link)) detail.deadLinks.push({ page: url, target: link.target_url, status: link.target_http_status });
    }
  }
  detail.scholarlySources = sources.size;
  const quality = detail.pageQuality ?? [];
  detail.rBacked = quality.length ? quality.reduce((sum, item) => sum + pageRBacked(item), 0) / quality.length : undefined;
  return detail;
};

/** Ceiling while no outbound link was status-checked: the absence of dead links is then unmeasured. */
export const UNVERIFIED_CITATION_CAP = 75;

/** True when citations exist to score but no outbound link was status-checked (crawl without checkCrawlExternalLinks). */
export const citationsUnverified = (detail: CitationDetail): boolean => detail.pagesAnalyzed > 0 && detail.checkedLinks === 0;

/** Legacy 0-100: article pages citing trusted sources, reduced by share of dead checked links, capped while unverified. Undefined without articles. */
const legacyCitationScore = (detail: CitationDetail): number => {
  const cited = detail.pagesWithTrusted / detail.pagesAnalyzed;
  const dead = detail.checkedLinks ? detail.deadLinks.length / detail.checkedLinks : 0;
  return Math.round(Math.max(0, Math.min(1, cited * (1 - 0.5 * dead))) * 100);
};

/** Claim-backed 0-100: mean over pages of min(1, sumQ/Qtarget) * (.40 + .60 * R_backed). Qtarget 4 for YMYL, 2 otherwise. */
const claimBackedScore = (detail: CitationDetail, ymyl: boolean): number => {
  const pages = detail.pageQuality ?? [];
  const target = ymyl ? Q_TARGET_YMYL : Q_TARGET_DEFAULT;
  return Math.round((pages.reduce((sum, item) => sum + claimBackedPageScore(item, target), 0) / Math.max(1, pages.length)) * 100);
};

/** 0-100 citation score under a versioned profile; the unverified-link cap applies to both. Undefined without articles. */
export const citationScore = (detail: CitationDetail, profile: ScoringProfile = 'legacy', ymyl = false): number | undefined => {
  if (!detail.pagesAnalyzed) return undefined;
  const score = profile === 'claim-backed-v1' ? claimBackedScore(detail, ymyl) : legacyCitationScore(detail);
  return citationsUnverified(detail) ? Math.min(score, UNVERIFIED_CITATION_CAP) : score;
};
