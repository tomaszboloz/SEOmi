import type { ClaimCitation } from './claims';
import { citationReferenceUrl } from './links';
import { HEDGE, NEGATION } from './stance';

/**
 * Local, deterministic claim support check (#88). It reads only the page text: where the citation sits,
 * whether it names an identifiable work, and whether the claim is hedged or negated. It never reads the
 * cited source, so it can say "associated" at best and never "supports" (D02: no entailment model).
 */
export type LocalSupportLevel = 'associated' | 'weak' | 'none';
export interface LocalSupport { level: LocalSupportLevel; hedged: boolean; negated: boolean }

const IDENTIFIED = new Set(['doi', 'pmid', 'pmcid', 'url']);

export const localSupportCheck = (claim: Pick<ClaimCitation, 'claim' | 'relation' | 'references'>): LocalSupport => {
  const identified = claim.references.some((ref) => IDENTIFIED.has(ref.kind));
  const level: LocalSupportLevel = claim.relation === 'unmatched' ? 'none'
    : claim.relation === 'same-sentence' && identified ? 'associated' : 'weak';
  return { level, hedged: HEDGE.test(claim.claim), negated: NEGATION.test(claim.claim) };
};

/** Source reachability after an explicit network check; 'not-checked' until the user asks for it. */
export type Reachability = 'reachable' | 'broken' | 'no-response' | 'not-checked';
export interface LinkStatus { status: number; is_broken: boolean }
export type LinkChecker = (url: string) => Promise<LinkStatus>;

export const MAX_REACHABILITY_CHECKS = 20;

/** Unique resolver URLs of the cited works (doi.org, PubMed, PMC or the cited http(s) URL), bounded. */
export const reachabilityTargets = (claims: ClaimCitation[], limit = MAX_REACHABILITY_CHECKS): string[] => [
  ...new Set(claims.flatMap((claim) => claim.references.map(citationReferenceUrl).filter((url): url is string => Boolean(url)))),
].slice(0, limit);

export const reachabilityOf = (result: LinkStatus | undefined): Reachability => {
  if (!result) return 'not-checked';
  if (result.status === 0) return 'no-response';
  return result.is_broken || result.status >= 400 ? 'broken' : 'reachable';
};

/** Checks each target once, sequentially (polite to resolvers); a failed call is 'no-response', never 'broken'. */
export const checkReachability = async (targets: string[], checker: LinkChecker, signal?: AbortSignal): Promise<Record<string, Reachability>> => {
  const out: Record<string, Reachability> = {};
  for (const url of targets) {
    if (signal?.aborted) break;
    try { out[url] = reachabilityOf(await checker(url)); } catch { out[url] = 'no-response'; }
  }
  return out;
};
