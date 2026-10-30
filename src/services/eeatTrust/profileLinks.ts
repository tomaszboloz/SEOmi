import { orcidChecksumValid } from './identifiers';
import type { ProfileEvidence } from './types';

const WIKIDATA_ID = /^Q[1-9]\d*$/;

/**
 * Canonical identifier page for a profile whose id passed syntax checks (#87): the ORCID record or the
 * Wikidata item. Built from the parsed id, never from the declared URL, so a look-alike host in the
 * page's sameAs cannot become the link. Undefined for other profile kinds or invalid ids.
 */
export const profileIdentifierUrl = (profile: Pick<ProfileEvidence, 'kind' | 'id'>): string | undefined => {
  if (!profile.id) return undefined;
  if (profile.kind === 'orcid' && orcidChecksumValid(profile.id.toUpperCase())) return `https://orcid.org/${profile.id.toUpperCase()}`;
  if (profile.kind === 'wikidata' && WIKIDATA_ID.test(profile.id)) return `https://www.wikidata.org/wiki/${profile.id}`;
  return undefined;
};

/** Detail codes produced by registry verification; anything else is shown as given. */
export const PROFILE_DETAIL_CODES = ['registry-unavailable', 'rate-budget', 'unsafe-redirect', 'body-limit', 'transport-error'] as const;
export const isKnownProfileDetail = (detail: string | undefined): detail is (typeof PROFILE_DETAIL_CODES)[number] => (
  PROFILE_DETAIL_CODES.includes(detail as (typeof PROFILE_DETAIL_CODES)[number])
);
