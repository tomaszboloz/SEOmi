import type { CrawledLink, CrawledPageSummary } from '@/types';
import type { CitationDetail } from './types';

/** Time-tested seed hosts: public institutions, scholarly publishers and standards bodies. */
const SEED_SUFFIX = /(^|\.)(gov|edu|mil|int)$|\.(gov|edu|ac|go|gouv)\.[a-z]{2}$|\.bund\.de$/i;
const SEED_HOSTS = new Set([
  'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'nih.gov', 'who.int', 'cdc.gov', 'europa.eu', 'ec.europa.eu', 'doi.org', 'dx.doi.org',
  'cochranelibrary.com', 'nature.com', 'sciencedirect.com', 'thelancet.com', 'nejm.org', 'bmj.com', 'jamanetwork.com', 'springer.com',
  'wiley.com', 'oecd.org', 'iso.org', 'w3.org', 'eur-lex.europa.eu', 'isap.sejm.gov.pl', 'orcid.org', 'arxiv.org', 'scholar.google.com',
]);

const hostOf = (url: string): string => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };

export const isTrustedHost = (host: string): boolean => Boolean(host) && (SEED_SUFFIX.test(host) || [...SEED_HOSTS].some((seed) => host === seed || host.endsWith(`.${seed}`)));
export const isDeadLink = (link: CrawledLink): boolean => Boolean(link.target_request_error_kind) || (link.target_http_status !== undefined && link.target_http_status >= 400);

/** Outbound citation quality for the given article pages (external links only). */
export const analyzeCitations = (pages: CrawledPageSummary[], articleUrls: Set<string>, citedBySchema: Map<string, string[]>): CitationDetail => {
  const detail: CitationDetail = { pagesAnalyzed: 0, pagesWithTrusted: 0, pagesWithAnyExternal: 0, trustedLinks: 0, externalLinks: 0, checkedLinks: 0, deadLinks: [] };
  for (const page of pages) {
    const url = page.final_url || page.url;
    if (!articleUrls.has(url)) continue;
    detail.pagesAnalyzed += 1;
    const external = page.links.filter((link) => !link.is_internal);
    const targets = new Set([...external.map((link) => link.target_url), ...(citedBySchema.get(url) ?? [])]);
    const trusted = [...targets].filter((target) => isTrustedHost(hostOf(target)));
    if (targets.size) detail.pagesWithAnyExternal += 1;
    if (trusted.length) detail.pagesWithTrusted += 1;
    detail.externalLinks += external.length;
    detail.trustedLinks += trusted.length;
    for (const link of external) {
      if (link.target_http_status === undefined && !link.target_request_error_kind) continue;
      detail.checkedLinks += 1;
      if (isDeadLink(link)) detail.deadLinks.push({ page: url, target: link.target_url, status: link.target_http_status });
    }
  }
  return detail;
};

/** Ceiling while no outbound link was status-checked: the absence of dead links is then unmeasured. */
export const UNVERIFIED_CITATION_CAP = 75;

/** True when citations exist to score but no outbound link was status-checked (crawl without checkCrawlExternalLinks). */
export const citationsUnverified = (detail: CitationDetail): boolean => detail.pagesAnalyzed > 0 && detail.checkedLinks === 0;

/** 0-100: article pages citing trusted sources, reduced by share of dead checked links, capped while unverified. Undefined without articles. */
export const citationScore = (detail: CitationDetail): number | undefined => {
  if (!detail.pagesAnalyzed) return undefined;
  const cited = detail.pagesWithTrusted / detail.pagesAnalyzed;
  const dead = detail.checkedLinks ? detail.deadLinks.length / detail.checkedLinks : 0;
  const score = Math.round(Math.max(0, Math.min(1, cited * (1 - 0.5 * dead))) * 100);
  return citationsUnverified(detail) ? Math.min(score, UNVERIFIED_CITATION_CAP) : score;
};
