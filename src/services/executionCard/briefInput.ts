export type BriefOrigin = 'sfs' | 'tas' | 'eetv';

export interface BriefLinkInput {
  donorUrls: string[];
  targetPillarUrl?: string;
  anchors?: string[];
}

export interface BriefFootnoteInput {
  attribute: string;
  value: string;
  sourceUrl: string;
}

/** Everything a recommendation from SFS, TAS or EETV can inject into a brief. Every field is optional real data. */
export interface BriefRecommendationInput {
  origin: BriefOrigin;
  title: string;
  /** Page the recommendation is about; the stable key that prevents duplicate briefs. */
  sourceUrl: string;
  missingEntities?: string[];
  links?: BriefLinkInput;
  paaQuestions?: string[];
  h2Structure?: string[];
  jsonLdAuthorGaps?: string[];
  footnotes?: BriefFootnoteInput[];
}
