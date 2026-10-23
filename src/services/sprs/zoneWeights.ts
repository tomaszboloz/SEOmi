import type { CrawledLink } from '@/types/crawl/links';

export type LinkZone = 'above_fold' | 'below_fold' | 'widget' | 'nav_breadcrumb' | 'sidebar_footer' | 'main' | 'unknown';

/** Reference input profile from issue #70 (a proposal, not a Google algorithm); #83 decides the final formula. */
export const SPRS_REFERENCE_WEIGHTS: Readonly<Record<Exclude<LinkZone, 'unknown' | 'main'>, number>> = {
  above_fold: 1,
  below_fold: 0.75,
  widget: 0.35,
  nav_breadcrumb: 0.25,
  sidebar_footer: 0.05,
};

export interface ZoneWeight {
  zone: string;
  /** null = zone unknown or not weighted by the profile; never silently 0 or 1. */
  weight: number | null;
}

/** `main` is content whose fold position is unproven from HTML, so it carries no weight without a render. */
export const linkZoneWeight = (link: Pick<CrawledLink, 'zone'>, profile: Readonly<Record<string, number>> = SPRS_REFERENCE_WEIGHTS): ZoneWeight => {
  const zone = typeof link.zone === 'string' && link.zone ? link.zone : 'unknown';
  const weight = profile[zone];
  return { zone, weight: Number.isFinite(weight) ? weight : null };
};
