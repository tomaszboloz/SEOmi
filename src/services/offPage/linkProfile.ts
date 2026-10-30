import type { BacklinkProfileData } from '@/types';
import { sourceDomain } from './sources';

/**
 * Sitewide/duplicate profile of the loaded backlink sample (#93 GEM-93-04). Raw counts are kept next to the
 * deduplicated view, so a footer or blogroll link repeated on hundreds of pages is visible but counts once.
 * Decision (default chosen by agent): a source domain is "sitewide" when at least SITEWIDE_MIN_PAGES distinct
 * source pages link with at most SITEWIDE_MAX_ANCHORS distinct anchors (a template link); "repeated" when it
 * has several source pages otherwise. Uncalibrated heuristic, shown as evidence, not a penalty.
 */
export const SITEWIDE_MIN_PAGES = 5;
export const SITEWIDE_MAX_ANCHORS = 2;
export const LINK_PROFILE_ROWS = 20;

export type LinkPattern = 'single' | 'repeated' | 'sitewide';
export interface DomainLinkProfile {
  domain: string;
  rawLinks: number;
  follow: number;
  nofollow: number;
  sourcePages: number;
  targetPages: number;
  anchors: number;
  pattern: LinkPattern;
}
export interface LinkDedupeProfile {
  rawLinks: number;
  domains: number;
  followDomains: number;
  sitewideDomains: number;
  repeatedDomains: number;
  /** Share of raw links that come from sitewide domains; null without links. */
  sitewideShare: number | null;
  /** True when the loaded rows are fewer than the provider total: the profile describes a sample. */
  sample: boolean;
  rows: DomainLinkProfile[];
}

const normalizedAnchor = (value: string): string => value.trim().replace(/\s+/gu, ' ').toLowerCase();

export const buildLinkProfile = (profile: BacklinkProfileData): LinkDedupeProfile => {
  const groups = new Map<string, { raw: number; follow: number; sources: Set<string>; targets: Set<string>; anchors: Set<string> }>();
  profile.backlinks.forEach((link) => {
    const domain = sourceDomain(link.source_url);
    const group = groups.get(domain) ?? { raw: 0, follow: 0, sources: new Set<string>(), targets: new Set<string>(), anchors: new Set<string>() };
    group.raw += 1;
    if (link.is_dofollow) group.follow += 1;
    group.sources.add(link.source_url);
    group.targets.add(link.target_url);
    group.anchors.add(normalizedAnchor(link.anchor_text));
    groups.set(domain, group);
  });
  const rows: DomainLinkProfile[] = [...groups].map(([domain, group]) => ({
    domain, rawLinks: group.raw, follow: group.follow, nofollow: group.raw - group.follow,
    sourcePages: group.sources.size, targetPages: group.targets.size, anchors: group.anchors.size,
    pattern: group.sources.size >= SITEWIDE_MIN_PAGES && group.anchors.size <= SITEWIDE_MAX_ANCHORS ? 'sitewide'
      : group.sources.size > 1 ? 'repeated' : 'single',
  }));
  const rawLinks = profile.backlinks.length;
  const sitewide = rows.filter((row) => row.pattern === 'sitewide');
  return {
    rawLinks, domains: rows.length, followDomains: rows.filter((row) => row.follow > 0).length,
    sitewideDomains: sitewide.length, repeatedDomains: rows.filter((row) => row.pattern === 'repeated').length,
    sitewideShare: rawLinks ? sitewide.reduce((sum, row) => sum + row.rawLinks, 0) / rawLinks : null,
    sample: rawLinks < profile.total_backlinks,
    rows: rows.sort((left, right) => right.rawLinks - left.rawLinks || left.domain.localeCompare(right.domain)).slice(0, LINK_PROFILE_ROWS),
  };
};
