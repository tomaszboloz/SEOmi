import { SITE_FOCUS_CODES, type CodeParams, type Coded, type Playbook } from './base';

export interface Effort { minHours: number; maxHours: number; estimate: true }
export interface Recommendation {
  code: (typeof SITE_FOCUS_CODES.recommendation)[number];
  params: CodeParams;
  /** Simulated SFS gain in points. */
  deltaScore: number;
  effort: Effort;
  /** deltaScore per average effort hour; the ranking key. */
  ratio: number;
  urls: string[];
}

export interface PlaybookOption {
  code: (typeof SITE_FOCUS_CODES.playbookOption)[number];
  params: CodeParams;
  /** Absent when the option removes the page from scoring; params.gain then carries the site gain. */
  expectedTrs?: { min: number; max: number; estimate: true };
  effort: Effort;
}
export interface PagePlaybook {
  url: string;
  playbook: Playbook;
  options: PlaybookOption[];
  steps: Coded[];
}

export interface TopicGap {
  code: (typeof SITE_FOCUS_CODES.gap)[number];
  label: string;
  terms: string[];
  coveragePct: number;
  pagesCovering: number;
}
export interface LinkSuggestion {
  code: 'link-to-hub';
  fromUrl: string;
  toUrl: string;
  anchors: string[];
}
