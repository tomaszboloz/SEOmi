/** One paragraph the copilot may rewrite, with the page context it needs. All values come from the real page. */
export interface PatchTarget {
  h1: string;
  /** H2 list of the page, in order. */
  h2: string[];
  /** Heading the paragraph sits under; null when it has none. */
  heading: string | null;
  paragraph: string;
  language: string;
  /** Entities the page already names. */
  pageEntities: string[];
  /** Entities competitors cover and this paragraph lacks. Empty means none are requested. */
  missingEntities: string[];
  /** Fragments the writer wants removed (for example echo passages from the IGOS heatmap). */
  removeFragments: string[];
}

export interface DanglingPronoun { sentence: string; pronoun: string }
export interface SpoGap { sentence: string }

export type PatchStatus = 'pending' | 'approved' | 'rejected';

/** Before/after pair. It stays `pending` until a person approves it; nothing is applied automatically. */
export interface PatchProposal {
  before: string;
  after: string;
  status: PatchStatus;
  /** Sentences removed by the fact gate (dose/amount without a source). */
  rejectedSentences: string[];
  /** True when the text was sent to a non-local provider. */
  leftDevice: boolean;
  fromCache: boolean;
}

export type PatchFailure = 'no-provider' | 'aborted' | 'empty-response' | 'provider-error';

export type PatchResult = { ok: true; proposal: PatchProposal } | { ok: false; reason: PatchFailure; detail?: string };
