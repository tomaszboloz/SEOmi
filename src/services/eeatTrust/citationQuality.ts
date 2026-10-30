import { backedRatio, type ClaimCitation } from '@/services/citationEvidence/claims';
import { scholarlyIds, scholarlyKey } from './citationIds';

/** Reference source classes: A identified scholarly work, B institutional host, C other, D dead. Host or DOI alone never proves truth. */
export type SourceClass = 'A' | 'B' | 'C' | 'D';
export const SOURCE_QUALITY: Record<SourceClass, number> = { A: 1, B: 0.7, C: 0.2, D: -0.3 };
export const Q_TARGET_YMYL = 4;
/** Non-YMYL pages are not forced to cite four studies (#88 D01). */
export const Q_TARGET_DEFAULT = 2;

export interface PageCitationQuality { page: string; sumQ: number; claims: number; backed: number; sources: Record<SourceClass, number> }

export const classifySource = (target: string, trusted: boolean, dead: boolean): SourceClass => (
  dead ? 'D' : scholarlyKey(scholarlyIds(target)) ? 'A' : trusted ? 'B' : 'C'
);

/** Only firm theses enter R_backed; hedged hypotheses and negations stay visible but are not demanded a citation (#88 GEM-88-04). */
export const firmClaims = (claims: ClaimCitation[]): ClaimCitation[] => claims.filter((claim) => (claim.stance ?? 'firm') === 'firm');

export const pageQuality = (page: string, classes: SourceClass[], allClaims: ClaimCitation[]): PageCitationQuality => {
  const claims = firmClaims(allClaims);
  const sources: Record<SourceClass, number> = { A: 0, B: 0, C: 0, D: 0 };
  classes.forEach((item) => { sources[item] += 1; });
  const sumQ = classes.reduce((sum, item) => sum + SOURCE_QUALITY[item], 0);
  return { page, sumQ, claims: claims.length, backed: Math.round(backedRatio(claims, sumQ) * claims.length), sources };
};

/** R_backed of one page record; mirrors backedRatio when the page holds no claims. */
export const pageRBacked = (item: PageCitationQuality): number => (item.claims ? item.backed / item.claims : backedRatio([], item.sumQ));

/** S_citation = min(1, max(0, sumQ) / Qtarget) * (.40 + .60 * R_backed), 0-1. */
export const claimBackedPageScore = (item: PageCitationQuality, qTarget: number): number => (
  Math.min(1, Math.max(0, item.sumQ) / qTarget) * (0.4 + 0.6 * pageRBacked(item))
);
